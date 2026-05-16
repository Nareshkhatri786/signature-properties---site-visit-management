import { GoogleGenAI } from "@google/genai";
import { query, queryOne } from "../../server.js";
import { WhatsAppService } from "./whatsapp-service.js";

const API_KEY = process.env.GEMINI_API_KEY || "";
let ai: any = null;

if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
}

interface IncomingMessage {
  from: string;
  text: string;
  timestamp: string;
}

/**
 * Parses the webhook payload. Adapts to Meta/WABA standard structure.
 */
function parseWebhookPayload(body: any): IncomingMessage | null {
  try {
    if (body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const msg = body.entry[0].changes[0].value.messages[0];
      return {
        from: msg.from,
        text: msg.text?.body || "",
        timestamp: msg.timestamp
      };
    }
    // Handle waofficial direct structure if different
    if (body?.message && body?.from) {
      return {
        from: body.from,
        text: body.message,
        timestamp: new Date().toISOString()
      };
    }
  } catch (e) {
    console.error("Failed to parse WhatsApp Webhook:", e);
  }
  return null;
}

export const processIncomingWhatsAppMessage = async (body: any) => {
  const message = parseWebhookPayload(body);
  if (!message || !message.text) return; // Not a text message or invalid

  console.log(`[WA Bot] Incoming message from ${message.from}: ${message.text}`);

  // 1. Find the Lead by phone number
  // Mobile numbers might have country codes. Try matching end of string.
  const phoneSuffix = message.from.length > 10 ? message.from.slice(-10) : message.from;
  const lead = await queryOne<any>("SELECT * FROM leads WHERE mobile LIKE ?", [`%${phoneSuffix}`]);
  
  if (!lead) {
    console.log(`[WA Bot] No lead found for phone ${message.from}`);
    return;
  }

  // 2. Update the 24-hour window timer for the lead
  await query("UPDATE leads SET last_client_reply_at = NOW() WHERE id = ?", [lead.id]);

  // 3. Save the incoming message to whatsapp_messages table
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  await query(
    "INSERT INTO whatsapp_messages (id, leadId, senderName, senderPhoneNumber, content, type) VALUES (?, ?, ?, ?, ?, ?)",
    [msgId, lead.id, lead.name, message.from, message.text, 'incoming']
  );

  // 4. Fetch recent chat history for context (last 10 messages)
  const history = await query<any[]>(
    "SELECT senderName, content, type FROM whatsapp_messages WHERE leadId = ? ORDER BY timestamp DESC LIMIT 10",
    [lead.id]
  );
  history.reverse(); // Chronological order

  const chatTranscript = history.map(h => `${h.type === 'incoming' ? 'Client' : 'AI'}: ${h.content}`).join("\n");

  // 5. Build the Gemini System Prompt
  const systemPrompt = `
You are the autonomous AI Sales Assistant for Signature Properties. 
Your goal is to converse with the client, answer queries, and ultimately schedule a SITE VISIT.
You MUST reply in the same language the client uses (English, Hindi, or Gujarati).

Client Name: ${lead.name}
Property Interest: ${lead.property_interest || 'Any'}

Recent Chat History:
${chatTranscript}

You MUST output your response in STRICT JSON format with no markdown wrappers or backticks. 
The JSON must have the following structure:
{
  "replyText": "The exact text message to send to the client via WhatsApp",
  "action": "NONE" | "SCHEDULE_VISIT" | "SCHEDULE_FOLLOWUP" | "ESCALATE_TO_HUMAN" | "SEND_BROCHURE",
  "actionData": {
    // Only if action is SCHEDULE_VISIT or SCHEDULE_FOLLOWUP
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    // Only if action is ESCALATE_TO_HUMAN
    "summary": "Short 1-sentence summary of the 10-minute chat for the human agent to read."
  }
}

Rules:
- Be polite, concise, and persuasive. 
- If the client asks to talk to a human or schedules a visit, set "action": "ESCALATE_TO_HUMAN" and provide a summary.
- If the client asks for a brochure, set "action": "SEND_BROCHURE".
  `;

  try {
    if (!ai) throw new Error("Gemini AI is not initialized");

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }]
    });

    const rawText = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text) || "{}";
    const cleanJsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiResult = JSON.parse(cleanJsonText);

    if (aiResult.replyText) {
      // 6. Check Sleeping Time (9 PM to 8 AM IST)
      const istHour = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).getHours();
      
      // Since this is a direct reply to an incoming message, we are ALLOWED to reply immediately, 
      // even at night, per the requirements ("Client-Initiated Chats: ALLOWED").
      
      await WhatsAppService.sendSessionMessage(message.from, aiResult.replyText);

      // Save AI outgoing message
      const outMsgId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await query(
        "INSERT INTO whatsapp_messages (id, leadId, senderName, senderPhoneNumber, content, type) VALUES (?, ?, ?, ?, ?, ?)",
        [outMsgId, lead.id, "AI Assistant", message.from, aiResult.replyText, 'outgoing']
      );
    }

    // 7. Handle CRM Database Actions
    if (aiResult.action === "SCHEDULE_VISIT") {
      const visitId = `visit_${Date.now()}`;
      await query(
        "INSERT INTO visits (id, leadId, client_name, mobile, visit_date, visit_time, status, visit_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [visitId, lead.id, lead.name, lead.mobile, aiResult.actionData?.date || null, aiResult.actionData?.time || null, 'hot', 'scheduled']
      );
      console.log(`[WA Bot] Scheduled visit for ${lead.name}`);
    } 
    else if (aiResult.action === "SCHEDULE_FOLLOWUP") {
      const followupId = `fu_${Date.now()}`;
      await query(
        "INSERT INTO followups (id, leadId, scheduled_date, notes, status) VALUES (?, ?, ?, ?, ?)",
        [followupId, lead.id, aiResult.actionData?.date || null, "AI Auto-scheduled follow-up", "pending"]
      );
    }
    else if (aiResult.action === "SEND_BROCHURE") {
      await WhatsAppService.sendMediaMessage(message.from, "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", "document", "Here is the project brochure you requested.");
    }
    else if (aiResult.action === "ESCALATE_TO_HUMAN") {
      const summary = aiResult.actionData?.summary || "Client needs human assistance.";
      // Save summary to lead stats or remarks
      const remarkId = `rmk_${Date.now()}`;
      await query("INSERT INTO remarks (id, leadId, content) VALUES (?, ?, ?)", [remarkId, lead.id, `[AI Chat Summary] ${summary}`]);
      
      // Update Lead Status to hot
      await query("UPDATE leads SET quality = 'hot' WHERE id = ?", [lead.id]);

      // TODO: Send WhatsApp to the assigned Agent
      // We need the agent's phone number. Assuming we can get it from users table.
      const agent = await queryOne<any>("SELECT mobile FROM users WHERE id = ?", [lead.assignedTo]);
      if (agent && agent.mobile) {
        const agentMsg = `🚨 *Hot Lead Alert*\nLead: ${lead.name} (${lead.mobile})\n\n*AI Chat Summary:*\n${summary}\n\nPlease check the CRM and follow up!`;
        await WhatsAppService.sendSessionMessage(agent.mobile, agentMsg);
      }
    }

  } catch (error) {
    console.error("[WA Bot] Error generating AI response:", error);
  }
};
