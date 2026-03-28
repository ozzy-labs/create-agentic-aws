import type { Preset, PresetName } from "../types.js";
import { createAmazonQPreset } from "./amazon-q.js";
import { createApiGatewayPreset } from "./api-gateway.js";
import { createBasePreset } from "./base.js";
import { createCdkPreset } from "./cdk.js";
import { createClaudeCodePreset } from "./claude-code.js";
import { createCloudFrontPreset } from "./cloudfront.js";
import { createCloudWatchPreset } from "./cloudwatch.js";
import { createCognitoPreset } from "./cognito.js";
import { createCopilotPreset } from "./copilot.js";
import { createDynamoDbPreset } from "./dynamodb.js";
import { createEcsPreset } from "./ecs.js";
import { createLambdaPreset } from "./lambda.js";
import { createPythonPreset } from "./python.js";
import { createS3Preset } from "./s3.js";
import { createSqsPreset } from "./sqs.js";
import { createTerraformPreset } from "./terraform.js";
import { createTypescriptPreset } from "./typescript.js";
import { createVpcPreset } from "./vpc.js";

/** Build the preset registry with all available presets. */
export function createRegistry(): Map<PresetName, Preset> {
  const presets: Preset[] = [
    createBasePreset(),
    createTypescriptPreset(),
    createPythonPreset(),
    createAmazonQPreset(),
    createClaudeCodePreset(),
    createCopilotPreset(),
    createCdkPreset(),
    createTerraformPreset(),
    createLambdaPreset(),
    createApiGatewayPreset(),
    createS3Preset(),
    createDynamoDbPreset(),
    createSqsPreset(),
    createCloudFrontPreset(),
    createCognitoPreset(),
    createCloudWatchPreset(),
    createVpcPreset(),
    createEcsPreset(),
    // Service presets will be added in M5-M6
  ];

  return new Map(presets.map((p) => [p.name, p]));
}
