import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

export const bedrockClient = new BedrockRuntimeClient({
  ...(REGION ? { region: REGION } : {}),
});
