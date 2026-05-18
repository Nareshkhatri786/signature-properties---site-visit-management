import { askGemini } from "../../gemini-service.js";
import { query, queryOne } from "../../db.js";
import { WhatsAppService } from "./whatsapp-service.js";

interface IncomingMessage {
  from: string;
  text: string;
  timestamp: string;
  projectId?: string;
}

const AI_GREETING_VARIANTS = [
  "Good morning Sir/Madam",
  "Namaste Sir/Madam",
  "Jay Shree Krishna Sir, kem chho?",
  "Good morning, hope you are doing well",
  "Namaste ji, aasha hai aap theek honge"
];

function pickAIGreeting(seed: string) {
  const dayKey = new Date().toISOString().slice(0, 10);
  const raw = `${seed}_${dayKey}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = ((hash << 5) - hash) + raw.charCodeAt(i);
  return AI_GREETING_VARIANTS[Math.abs(hash) % AI_GREETING_VARIANTS.length];
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
        timestamp: new Date().toISOString(),
        projectId: body.projectId
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

  // The phone number ID to reply FROM (the project's WA number)
  const replyFromPhoneId = body.phoneNoId || body.recipientPhoneNumberId || undefined;

  console.log(`[WA Bot] Incoming message from ${message.from}: ${message.text}`);

  // 1. Find the Lead by phone number
  const phoneSuffix = message.from.length > 10 ? message.from.slice(-10) : message.from;
  let lead = message.projectId
    ? await queryOne<any>(
        "SELECT * FROM leads WHERE mobile LIKE ? AND projectId = ? ORDER BY updated_at DESC LIMIT 1",
        [`%${phoneSuffix}`, message.projectId]
      )
    : await queryOne<any>("SELECT * FROM leads WHERE mobile LIKE ? ORDER BY updated_at DESC LIMIT 1", [`%${phoneSuffix}`]);
  
  if (!lead) {
    console.log(`[WA Bot] Error: Lead should have been created by server.ts already.`);
    return;
  }

  // 2. Update the 24-hour window timer for the lead
  await query("UPDATE leads SET last_client_reply_at = NOW() WHERE id = ?", [lead.id]);



  // 3. Get Project Details for AI context
  let projectContext = "";
  let mediaLinks: any = {};
  
  // CRITICAL: Use the project the client messaged FOR (from the webhook) 
  // instead of the project the lead is assigned to in the CRM.
  const targetProjectId = message.projectId || lead.projectId;

  // 4. Fetch recent chat history for only this project number/context.
  // A single client may enquire on multiple project WhatsApp numbers; never
  // leak another project's discussion into the current AI prompt.
  const history = await query<any[]>(
    "SELECT senderName, content, type FROM whatsapp_messages WHERE leadId = ? AND projectId = ? ORDER BY timestamp DESC LIMIT 10",
    [lead.id, targetProjectId]
  );
  history.reverse(); // Chronological order

  const chatTranscript = history.map(h => `${h.type === 'incoming' ? 'Client' : 'AI'}: ${h.content}`).join("\n");

  if (targetProjectId) {
    const proj = await queryOne<any>("SELECT * FROM projects WHERE id = ?", [targetProjectId]);
    if (proj) {
      mediaLinks = {
        brochure: proj.brochure_link,
        walkthrough: proj.walkthrough_video,
        location: proj.google_maps_link
      };
      projectContext = `
Client is specifically interested in: ${proj.name}
Description: ${proj.description || 'Premium Real Estate Project'}
Strict AI Rules for this project: ${proj.ai_rules || 'No specific rules.'}

Available Media to send (ONLY send if explicitly asked by client):
- Brochure: ${proj.brochure_link ? 'Available' : 'Not Available'}
- Walkthrough Video: ${proj.walkthrough_video ? 'Available' : 'Not Available'}
- Sample House Video: ${proj.sample_house_video ? 'Available' : 'Not Available'}
- Location Map: ${proj.google_maps_link ? 'Available' : 'Not Available'}
`;
    }
  } else {
    // Lead is NEW / Unassigned. Provide the AI with ALL projects so it can guide the client.
    const allProjects = await query<any[]>("SELECT * FROM projects");
    const projList = allProjects.map(p => `
- **${p.name}**: ${p.description || ''}. 
  Strict Rules: ${p.ai_rules || 'No specific rules.'}`).join("\n");

    projectContext = `
The client is new and has not selected a project yet. 
Here is a list of all our available projects. Ask them what they are looking for and guide them based on these rules:
${projList}
`;
  }

  // 5. Build the Gemini System Prompt
  const systemPrompt = `
You are the autonomous AI Sales Assistant for Signature Properties. 
Your goal is to converse with the client, answer queries, and ultimately schedule a SITE VISIT.
You MUST reply in the same language the client uses (English, Hindi, or Gujarati).

Client Name: ${lead.name}
Property Interest: ${lead.property_interest || 'Any'}

${projectContext}

Recent Chat History:
${chatTranscript}

You MUST output your response in STRICT JSON format with no markdown wrappers or backticks. 
The JSON must have the following structure:
{
  "replyText": "The exact text message to send to the client via WhatsApp",
  "action": "NONE" | "SCHEDULE_VISIT" | "SCHEDULE_FOLLOWUP" | "ESCALATE_TO_HUMAN" | "SEND_BROCHURE" | "SEND_WALKTHROUGH" | "SEND_LOCATION",
  "actionData": {
    // Only if action is SCHEDULE_VISIT or SCHEDULE_FOLLOWUP
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    // Only if action is ESCALATE_TO_HUMAN
    "summary": "Short 1-sentence summary of the chat for the human agent to read."
  }
}

Rules:
- Be polite, concise, and persuasive. Use SIMPLE, SHORT, and CONVERSATIONAL language.
- Avoid long formal paragraphs. Be direct like a human salesperson on WhatsApp.
- Greeting style should be professional and natural. Rotate tone naturally across conversations:
  sometimes "Good morning", sometimes "Namaste", sometimes "Jay Shree Krishna, kem chho?".
  Do not repeat the exact same greeting pattern in every chat.
- NEVER violate the 'Strict AI Rules'.
- If the client asks to talk to a human or schedules a visit, set "action": "ESCALATE_TO_HUMAN" and provide a summary.
- If the client asks for media (brochure, video, map), set the corresponding "action" to trigger the system to send it.
  `;

  try {
    const rawText = await askGemini(systemPrompt, projectContext);
    const cleanJsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiResult = JSON.parse(cleanJsonText);

    if (aiResult.replyText) {
      // 6. Check Sleeping Time (9 PM to 8 AM IST)
      const istHour = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).getHours();
      
      // Since this is a direct reply to an incoming message, we are ALLOWED to reply immediately, 
      // even at night, per the requirements ("Client-Initiated Chats: ALLOWED").
      
      let finalReply = String(aiResult.replyText || "").trim();
      const today = new Date().toISOString().slice(0, 10);
      const sentToday = await queryOne<any>(
        "SELECT id FROM whatsapp_messages WHERE leadId = ? AND projectId = ? AND type = 'outgoing' AND DATE(timestamp) = ? LIMIT 1",
        [lead.id, targetProjectId || null, today]
      );
      if (!sentToday) {
        finalReply = `${pickAIGreeting(String(lead.id || message.from))}\n\n${finalReply}`;
      }

      await WhatsAppService.sendSessionMessage(message.from, finalReply, replyFromPhoneId);

      // Save AI outgoing message to WhatsApp history
      const outMsgId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await query(
        "INSERT INTO whatsapp_messages (id, leadId, senderName, senderPhoneNumber, content, type, projectId) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [outMsgId, lead.id, "AI Assistant", message.from, finalReply, 'outgoing', targetProjectId]
      );

      // Save to Timeline as Automated Remark
      const rmkId = `rmk_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await query(
        "INSERT INTO remarks (id, targetId, text, `by`, type, category) VALUES (?, ?, ?, ?, ?, ?)",
        [rmkId, lead.id, finalReply, "SYSTEM / AUTOMATED", "automated", "ai"]
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
    else if (aiResult.action === "SEND_BROCHURE" && mediaLinks?.brochure) {
      await WhatsAppService.sendMediaMessage(message.from, mediaLinks.brochure, "document", "Here is the project brochure you requested.");
    }
    else if (aiResult.action === "SEND_WALKTHROUGH" && mediaLinks?.walkthrough) {
      await WhatsAppService.sendMediaMessage(message.from, mediaLinks.walkthrough, "video", "Here is the project walkthrough video.");
    }
    else if (aiResult.action === "SEND_LOCATION" && mediaLinks?.location) {
      await WhatsAppService.sendSessionMessage(message.from, `Here is the location link: ${mediaLinks.location}`);
    }
    else if (aiResult.action === "ESCALATE_TO_HUMAN") {
      const summary = aiResult.actionData?.summary || "Client needs human assistance.";
      // Save summary to lead stats or remarks
      const rmkId = `rmk_${Date.now()}`;
      await query("INSERT INTO remarks (id, targetId, text, `by`, type) VALUES (?, ?, ?, ?, ?)", [rmkId, lead.id, `[AI Chat Summary] ${summary}`, "SYSTEM", "remark"]);
      
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
