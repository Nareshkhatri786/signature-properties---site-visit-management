import { GoogleGenAI } from "@google/genai";

let ai: any = null;

try {
  // Initialize for Vertex AI using Application Default Credentials
  ai = new GoogleGenAI({
    vertexai: {
      project: 'project-fd997589-8381-4e09-a8c',
      location: 'asia-south1'
    }
  });
  console.log("[AI] Successfully initialized Vertex AI");
} catch (e) {
  console.warn("Failed to initialize GoogleGenAI for Vertex AI:", e);
}

export const askGemini = async (prompt: string, context: string = "") => {
  if (!ai) {
    throw new Error("Vertex AI is not initialized. Please check VM credentials.");
  }

  const systemPrompt = `
    You are an intelligent AI assistant for the Signature Properties CRM.
    Your tone should be professional and helpful.
    
    Context about the current situation:
    ${context}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
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
