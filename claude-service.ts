import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const region = process.env.AWS_REGION || "ap-southeast-2";

const client = new BedrockRuntimeClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const modelId = process.env.CLAUDE_MODEL_ID || "anthropic.claude-3-5-sonnet-20240620-v1:0";

export const askClaudeAWS = async (prompt: string, context: string = "") => {
  const botName = process.env.AI_BOT_NAME || "Signature-AWS-Claude";
  
  const systemPrompt = `
    You are "${botName}", a sophisticated AI model running on Amazon Web Services (AWS) via Bedrock.
    You are an integral part of the Signature Properties CRM.
    Your tone should be professional, intelligent, and helpful.
    When asked about your identity, you should mention that you are the AWS-powered Claude 3.5 Sonnet model.
    
    Context about the current situation:
    ${context}
  `;

  try {
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    };

    const command = new InvokeModelCommand({
      contentType: "application/json",
      accept: "application/json",
      modelId,
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const decodedResponseBody = new TextDecoder().decode(response.body);
    const responseJson = JSON.parse(decodedResponseBody);

    return responseJson.content[0].text || "I am sorry, I couldn't generate a response.";
  } catch (error: any) {
    console.error("AWS Bedrock Error:", error);
    throw new Error(`AWS Bedrock Error: ${error.message}`);
  }
};
