import { ConverseCommand, type Message } from "@aws-sdk/client-bedrock-runtime";
import { bedrockClient } from "./client";

const DEFAULT_MODEL_ID = "anthropic.claude-sonnet-4-20250514";

export interface InvokeOptions {
  modelId?: string;
  messages: Message[];
  systemPrompt?: string;
  maxTokens?: number;
}

export async function invokeModel(options: InvokeOptions): Promise<string> {
  const { modelId = DEFAULT_MODEL_ID, messages, systemPrompt, maxTokens = 1024 } = options;

  const response = await bedrockClient.send(
    new ConverseCommand({
      modelId,
      messages,
      ...(systemPrompt
        ? { system: [{ text: systemPrompt }] }
        : {}),
      inferenceConfig: { maxTokens },
    }),
  );

  const content = response.output?.message?.content;
  if (!content?.[0] || !("text" in content[0])) {
    throw new Error("Unexpected response format from Bedrock");
  }
  return content[0].text ?? "";
}
