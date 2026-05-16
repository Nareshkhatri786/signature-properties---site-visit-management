import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "";
let ai: any = null;

try {
  if (API_KEY) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
} catch (e) {
  console.warn("Failed to initialize GoogleGenAI:", e);
}

export const askGemini = async (prompt: string, context: string = "") => {
  if (!ai) {
    throw new Error("Gemini API is not initialized. Please check your GEMINI_API_KEY.");
  }

  const systemPrompt = `
    You are an intelligent AI assistant for the Signature Properties CRM.
    Your tone should be professional and helpful.
    
    Context about the current situation:
    ${context}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-live-preview",
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\nUser Request: ${prompt}\n\nStrictly follow all formatting requirements in the request.` }] }
      ]
    });
    
    // The @google/genai package might return text differently
    const text = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text) || "";
    return text || "I am sorry, I couldn't generate a response.";
  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    throw new Error(`Gemini Error: ${error.message}`);
  }
};
