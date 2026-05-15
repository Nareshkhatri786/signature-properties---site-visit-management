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

/**
 * Interface for Claude 3.5 Sonnet on AWS Bedrock
 */
export const askClaude = async (prompt: string, systemPrompt?: string): Promise<string> => {
  try {
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1000,
      system: systemPrompt || "You are a helpful assistant for Signature Properties CRM.",
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

    return responseJson.content[0].text || "No response from Claude.";
  } catch (error: any) {
    console.error("Error calling Claude via Bedrock:", error);
    return `Error: ${error.message}`;
  }
};
