import { GoogleGenAI } from "@google/genai";

// Initialize using Application Default Credentials (ADC) via Vertex AI backend
// On Google Cloud VM, the attached Service Account is automatically used
let ai: GoogleGenAI | null = null;

try {
  ai = new GoogleGenAI({
    vertexai: true,
    project: 'project-fd997589-8381-4e09-a8c',
    location: 'us-central1',
  } as any);
  console.log("[AI] Successfully initialized Vertex AI via @google/genai SDK");
} catch (e) {
  console.warn("Failed to initialize Vertex AI:", e);
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

  const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}\n\nStrictly follow all formatting requirements in the request.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    });

    const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text || "I am sorry, I couldn't generate a response.";
  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    throw new Error(`Gemini Error: ${error.message}`);
  }
};
