import { GoogleGenAI } from "@google/genai";
import { Visit, Remark, Lead, LeadQuality } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const aiService = {
  generateFollowUp: async (visit: Visit, remarks: Remark[]) => {
    if (!process.env.GEMINI_API_KEY) return null;

    const remarksText = remarks.map(r => `- ${r.text}`).join("\n");
    const prompt = `
      You are a luxury real estate sales assistant for "Signature Properties".
      Generate a professional, warm, and persuasive WhatsApp follow-up message for a client.
      
      Client Name: ${visit.client_name}
      Visit Date: ${visit.visit_date}
      Property Interest: ${visit.property_interest || "General interest"}
      Budget: ${visit.budget || "Not specified"}
      Lead Status: ${visit.status}
      
      Recent Remarks/Notes from the visit:
      ${remarksText}
      
      The message should:
      1. Thank them for their visit.
      2. Reference specific points from the remarks to show we listened.
      3. Maintain a luxury, premium tone.
      4. Include a clear call to action (e.g., "Would you like to see the floor plans again?" or "Shall we schedule a second visit?").
      5. Be concise (WhatsApp length).
      6. Use emojis sparingly but effectively.
      
      Return ONLY the message text.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text?.trim() || null;
    } catch (error) {
      console.error("AI Generation Error:", error);
      return null;
    }
  },

  scoreLead: async (lead: Lead, remarks: Remark[]) => {
    if (!process.env.GEMINI_API_KEY) return null;

    const remarksText = remarks.map(r => `- ${r.text}`).join("\n");
    const prompt = `
      You are a luxury real estate sales assistant.
      Analyze the following lead, their preferences, and conversation history to determine their quality.
      
      Lead Name: ${lead.name}
      Lead Status: ${lead.status}
      Property Interest: ${lead.property_interest || "Not specified"}
      Budget: ${lead.budget || "Not specified"}
      Current Quality: ${lead.quality}
      
      Conversation History:
      ${remarksText}
      
      Based on the history and profile, categorize the lead quality as:
      - "hot": High interest, clear budget match, ready to buy/visit, active engagement, positive sentiment.
      - "warm": Interested but has hesitations, or budget is a slight mismatch, or needs more follow-up. Neutral sentiment.
      - "cold": Low interest, not responding well, budget completely out of range, or negative sentiment.
      - "disq": Not a fit for our luxury properties (e.g., extremely low budget, wrong location, not looking for real estate).
      
      Considering the Property Interest ("${lead.property_interest}") and Budget ("${lead.budget}"), if they match well with luxury properties, lean towards "hot" or "warm".
      
      Return ONLY one word: hot, warm, cold, or disq.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      const result = response.text?.trim().toLowerCase();
      if (['hot', 'warm', 'cold', 'disq'].includes(result || '')) {
        return result as LeadQuality;
      }
      return null;
    } catch (error) {
      console.error("AI Scoring Error:", error);
      return null;
    }
  }
};
