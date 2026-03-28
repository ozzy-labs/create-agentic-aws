import type { Preset, PresetName, WizardAnswers } from "../types.js";

export const PRESET_ORDER: readonly PresetName[] = [
  "base",
  "typescript",
  "python",
  "amazon-q",
  "claude-code",
  "copilot",
  "cdk",
  "terraform",
  "vpc",
  "lambda",
  "ecs",
  "eks",
  "ec2",
  "bedrock",
  "bedrock-kb",
  "bedrock-agents",
  "opensearch",
  "s3",
  "dynamodb",
  "aurora",
  "rds",
  "kinesis",
  "glue",
  "redshift",
  "sqs",
  "sns",
  "eventbridge",
  "step-functions",
  "api-gateway",
  "cloudfront",
  "cognito",
  "cloudwatch",
];

const VPC_TRIGGERS: ReadonlySet<PresetName> = new Set([
  "ecs",
  "eks",
  "ec2",
  "aurora",
  "rds",
  "redshift",
]);

/**
 * Resolves the full set of presets from wizard answers, including auto-resolved
 * dependencies (VPC, languages) and transitive requires. Returns presets sorted
 * by canonical {@link PRESET_ORDER} for deterministic composition.
 */
export function resolvePresets(
  answers: WizardAnswers,
  registry: ReadonlyMap<PresetName, Preset>,
): Preset[] {
  const selected = new Set<PresetName>();

  selected.add("base");

  for (const name of answers.languages) selected.add(name);
  for (const name of answers.agents) selected.add(name);
  selected.add(answers.iac);
  for (const name of answers.compute) selected.add(name);
  for (const name of answers.ai) selected.add(name);
  for (const name of answers.data) selected.add(name);
  for (const name of answers.dataPipeline ?? []) selected.add(name);
  for (const name of answers.integration) selected.add(name);
  for (const name of answers.networking) selected.add(name);
  for (const name of answers.security) selected.add(name);
  for (const name of answers.observability) selected.add(name);

  for (const name of selected) {
    if (VPC_TRIGGERS.has(name)) {
      selected.add("vpc");
      break;
    }
  }
  if (answers.lambdaOptions?.vpcPlacement) {
    selected.add("vpc");
  }
  if (answers.openSearchOptions?.mode === "managed-cluster") {
    selected.add("vpc");
  }

  const resolved = new Set<PresetName>(selected);
  const queue = [...selected];
  for (let name = queue.pop(); name !== undefined; name = queue.pop()) {
    const preset = registry.get(name);
    if (preset?.requires) {
      for (const dep of preset.requires) {
        if (!resolved.has(dep)) {
          resolved.add(dep);
          queue.push(dep);
        }
      }
    }
  }

  return PRESET_ORDER.filter((name) => resolved.has(name))
    .map((name) => registry.get(name))
    .filter((p): p is Preset => p !== undefined);
}
