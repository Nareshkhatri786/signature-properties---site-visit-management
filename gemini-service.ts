import { VertexAI } from "@google-cloud/vertexai";

// Initialize using Application Default Credentials (ADC)
// On Google Cloud VM, this automatically uses the attached Service Account
let vertexAI: VertexAI | null = null;
let model: any = null;

try {
  vertexAI = new VertexAI({
    project: 'project-fd997589-8381-4e09-a8c',
    location: 'asia-south1',
  });

  model = vertexAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
  });

  console.log("[AI] Successfully initialized Vertex AI (google-cloud/vertexai)");
} catch (e) {
  console.warn("Failed to initialize Vertex AI:", e);
}

export const askGemini = async (prompt: string, context: string = "") => {
  if (!model) {
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
    const request = {
      contents: [{ role: "user" as const, parts: [{ text: fullPrompt }] }],
    };

    const result = await model.generateContent(request);
    const response = await result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text || "I am sorry, I couldn't generate a response.";
  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    throw new Error(`Gemini Error: ${error.message}`);
  }
};
