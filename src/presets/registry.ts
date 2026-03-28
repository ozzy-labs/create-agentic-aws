import type { Preset, PresetName } from "../types.js";
import { createAmazonQPreset } from "./amazon-q.js";
import { createApiGatewayPreset } from "./api-gateway.js";
import { createAuroraPreset } from "./aurora.js";
import { createBasePreset } from "./base.js";
import { createBedrockPreset } from "./bedrock.js";
import { createBedrockAgentsPreset } from "./bedrock-agents.js";
import { createBedrockKbPreset } from "./bedrock-kb.js";
import { createCdkPreset } from "./cdk.js";
import { createClaudeCodePreset } from "./claude-code.js";
import { createCloudFrontPreset } from "./cloudfront.js";
import { createCloudWatchPreset } from "./cloudwatch.js";
import { createCognitoPreset } from "./cognito.js";
import { createCopilotPreset } from "./copilot.js";
import { createDynamoDbPreset } from "./dynamodb.js";
import { createEc2Preset } from "./ec2.js";
import { createEcsPreset } from "./ecs.js";
import { createEksPreset } from "./eks.js";
import { createEventBridgePreset } from "./eventbridge.js";
import { createGluePreset } from "./glue.js";
import { createKinesisPreset } from "./kinesis.js";
import { createLambdaPreset } from "./lambda.js";
import { createOpenSearchPreset } from "./opensearch.js";
import { createPythonPreset } from "./python.js";
import { createRdsPreset } from "./rds.js";
import { createRedshiftPreset } from "./redshift.js";
import { createS3Preset } from "./s3.js";
import { createSnsPreset } from "./sns.js";
import { createSqsPreset } from "./sqs.js";
import { createStepFunctionsPreset } from "./step-functions.js";
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
    createEksPreset(),
    createEc2Preset(),
    createBedrockPreset(),
    createBedrockKbPreset(),
    createBedrockAgentsPreset(),
    createOpenSearchPreset(),
    createAuroraPreset(),
    createRdsPreset(),
    createKinesisPreset(),
    createGluePreset(),
    createRedshiftPreset(),
    createSnsPreset(),
    createEventBridgePreset(),
    createStepFunctionsPreset(),
  ];

  const registry = new Map<PresetName, Preset>(presets.map((p) => [p.name, p]));
  validateRegistry(registry);
  return registry;
}

// ---------------------------------------------------------------------------
// Registry validation
// ---------------------------------------------------------------------------

/**
 * Validate the preset registry for:
 * - References to non-existent presets in `requires`
 * - Circular dependencies in `requires`
 */
export function validateRegistry(registry: ReadonlyMap<PresetName, Preset>): void {
  // Check for references to non-existent presets
  for (const [name, preset] of registry) {
    if (!preset.requires) continue;
    for (const dep of preset.requires) {
      if (!registry.has(dep)) {
        throw new Error(`Preset "${name}" requires "${dep}" which does not exist in the registry`);
      }
    }
  }

  // Check for circular dependencies using DFS
  const visited = new Set<PresetName>();
  const inStack = new Set<PresetName>();

  function dfs(name: PresetName, path: PresetName[]): void {
    if (inStack.has(name)) {
      const cycle = [...path.slice(path.indexOf(name)), name];
      throw new Error(`Circular dependency detected: ${cycle.join(" → ")}`);
    }
    if (visited.has(name)) return;

    inStack.add(name);
    path.push(name);

    const preset = registry.get(name);
    if (preset?.requires) {
      for (const dep of preset.requires) {
        dfs(dep, path);
      }
    }

    path.pop();
    inStack.delete(name);
    visited.add(name);
  }

  for (const name of registry.keys()) {
    dfs(name, []);
  }
}
