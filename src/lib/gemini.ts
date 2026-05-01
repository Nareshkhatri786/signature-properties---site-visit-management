import { GoogleGenAI } from "@google/genai";
import { Lead, Visit, FollowUp } from "../types";

const API_KEY = (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : (import.meta as any).env?.VITE_GEMINI_API_KEY) || "";

let ai: any = null;
try {
  if (API_KEY) {
    ai = new GoogleGenAI(API_KEY);
  }
} catch (e) {
  console.warn("Failed to initialize GoogleGenAI:", e);
}

export interface SalesInsight {
  focusLeads: { id: string; reason: string }[];
  actionItems: string[];
  summary: string;
}

export async function getDailySalesInsights(
  leads: Lead[],
  followUps: FollowUp[],
  visits: Visit[],
  userName: string
): Promise<SalesInsight> {
  const today = new Date().toISOString().split('T')[0];
  
  // Prepare data for AI context
  const context = {
    userName,
    date: today,
    stats: {
      totalLeads: leads.length,
      hotLeads: leads.filter(l => l.quality === 'hot').length,
      pendingFollowups: followUps.filter(f => f.status === 'pending').length,
      scheduledVisitsToday: visits.filter(v => v.visit_date === today).length
    },
    urgentFollowups: followUps
      .filter(f => f.status === 'pending' && f.date <= today)
      .slice(0, 5)
      .map(f => {
        const lead = leads.find(l => l.id === f.leadId);
        return { name: lead?.name || 'Unknown', purpose: f.purpose, date: f.date };
      }),
    topLeads: leads
      .filter(l => l.quality === 'hot')
      .slice(0, 10)
      .map(l => ({ name: l.name, status: l.status, lastUpdated: l.updated_at }))
  };

  try {
    if (!ai) throw new Error("AI not initialized (Missing API Key)");
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const response = await model.generateContent(`You are a high-performance Real Estate Sales Coach. 
      Analyze the current sales data for ${userName} and provide a concise, motivating daily advisor report in JSON format.
      
      Data Context:
      ${JSON.stringify(context)}
      
      Response Requirements:
      - focusLeads: List of 3 specific leads (name and one-sentence reason why they need attention today).
      - actionItems: 3-4 bullet points of high-impact actions.
      - summary: A 2-sentence motivating summary of the day's potential.
      - Return ONLY a JSON object matching the SalesInsight interface.`);

    const result = JSON.parse(response.response.text() || "{}");
    return {
      focusLeads: result.focusLeads || [],
      actionItems: result.actionItems || [],
      summary: result.summary || "Ready for another productive day in real estate!"
    };
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return {
      focusLeads: [],
      actionItems: ["Focus on hot leads with no recent activity", "Check today's scheduled visits"],
      summary: "Let's capture some great leads today!"
    };
  }
}
