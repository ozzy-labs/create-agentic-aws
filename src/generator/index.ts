import type { Preset, PresetName, WizardAnswers } from "../types.js";
import { GenerateResult } from "../types.js";
import {
  collectIacContributions,
  distributeMcpServers,
  expandMarkdownTemplates,
  mergeSharedFiles,
  stripMergeMarkers,
} from "./finalize.js";
import { substituteVars } from "./helpers.js";
import { resolvePresets } from "./resolve.js";
import {
  applyBedrockAgentKbWiring,
  applyBedrockKbOpenSearchWiring,
  applyCloudWatchWidgets,
  applyCognitoApiGatewayAuth,
  applyDynamoDbLambdaIntegration,
  applyEventBridgeLambdaWiring,
  applyKinesisLambdaWiring,
  applyLambdaPythonDeps,
  applyLambdaPythonRuntime,
  applyLambdaVpcPlacement,
  applyOpenSearchManagedMode,
  applyRdsEngineOption,
  applyReadmeLabels,
  applyRedshiftProvisionedMode,
  applySqsLambdaWiring,
  ensureTsconfigBase,
} from "./transform.js";

export { resolvePresets } from "./resolve.js";

/**
 * Main generation pipeline. Composes selected presets into a complete project:
 *
 * 1. **Resolve** — select presets, auto-resolve dependencies, sort by canonical order
 * 2. **Compose** — collect owned files + IaC contributions (CDK/Terraform)
 * 3. **Transform** — apply service-specific mutations (VPC placement, engine swap, etc.)
 * 4. **Finalize** — deep-merge shared files, distribute MCP servers, expand markdown, strip markers
 */
export function generate(
  answers: WizardAnswers,
  registry: ReadonlyMap<PresetName, Preset>,
): GenerateResult {
  const presets = resolvePresets(answers, registry);
  const vars = { projectName: answers.projectName };
  const files = new Map<string, string>();

  // --- Phase 1: Collect owned files ---
  for (const preset of presets) {
    for (const [path, content] of Object.entries(preset.files)) {
      files.set(path, substituteVars(content, vars));
    }
  }

  // --- Phase 2: IaC contributions ---
  collectIacContributions(presets, answers.iac, files, vars);

  // --- Phase 3: Service-specific transformations ---
  const presetNames = new Set(presets.map((p) => p.name));

  if (answers.lambdaOptions?.vpcPlacement) {
    applyLambdaVpcPlacement(answers.iac, files);
  }
  if (answers.rdsOptions?.engine === "mysql") {
    applyRdsEngineOption(answers.iac, files);
  }
  if (answers.openSearchOptions?.mode === "managed-cluster") {
    applyOpenSearchManagedMode(answers.iac, files);
  }
  if (presetNames.has("bedrock-kb") && presetNames.has("opensearch")) {
    applyBedrockKbOpenSearchWiring(answers, files);
  }
  if (answers.redshiftOptions?.mode === "provisioned") {
    applyRedshiftProvisionedMode(answers.iac, files);
  }
  if (presetNames.has("lambda") && presetNames.has("python") && !presetNames.has("typescript")) {
    applyLambdaPythonRuntime(files, vars);
  }
  if (presetNames.has("dynamodb") && presetNames.has("lambda")) {
    applyDynamoDbLambdaIntegration(answers.iac, files);
  }
  if (presetNames.has("cognito") && presetNames.has("api-gateway") && answers.iac === "terraform") {
    applyCognitoApiGatewayAuth(files);
  }
  if (presetNames.has("bedrock-agents") && presetNames.has("bedrock-kb")) {
    applyBedrockAgentKbWiring(answers.iac, files);
  }
  if (presetNames.has("kinesis") && presetNames.has("lambda")) {
    applyKinesisLambdaWiring(answers.iac, files);
  }
  if (presetNames.has("sqs") && presetNames.has("lambda")) {
    applySqsLambdaWiring(answers.iac, files);
  }
  if (presetNames.has("eventbridge") && presetNames.has("lambda")) {
    applyEventBridgeLambdaWiring(answers.iac, files);
  }
  if (presetNames.has("cloudwatch")) {
    applyCloudWatchWidgets(presetNames, answers.iac, files, vars);
  }
  ensureTsconfigBase(presets, files);

  // --- Phase 4: Merge, distribute, expand, clean up ---
  mergeSharedFiles(presets, files, vars);

  if (presetNames.has("lambda") && presetNames.has("python") && !presetNames.has("typescript")) {
    applyLambdaPythonDeps(files);
  }

  distributeMcpServers(presets, answers, files);
  expandMarkdownTemplates(presets, files);
  applyReadmeLabels(answers, presetNames, files);
  stripMergeMarkers(files);

  return new GenerateResult(files);
}
