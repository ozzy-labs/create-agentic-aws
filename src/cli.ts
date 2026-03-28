import * as p from "@clack/prompts";
import pc from "picocolors";

import { t } from "./i18n/index.js";
import type {
  AgentPresetName,
  AiPresetName,
  ApiGatewayOptions,
  AuroraCapacity,
  AuroraEngine,
  AuroraOptions,
  ComputePresetName,
  DataPipelinePresetName,
  DataPresetName,
  Ec2Options,
  EcsLaunchType,
  EcsOptions,
  EksMode,
  EksOptions,
  IacPresetName,
  IntegrationPresetName,
  LambdaOptions,
  LanguagePresetName,
  LoadBalancerType,
  NetworkingPresetName,
  ObservabilityPresetName,
  OpenSearchMode,
  OpenSearchOptions,
  RdsEngine,
  RdsOptions,
  RedshiftMode,
  RedshiftOptions,
  SecurityPresetName,
  WizardAnswers,
} from "./types.js";

// ---------------------------------------------------------------------------
// Cancel guard
// ---------------------------------------------------------------------------

function guard<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel(t("cancelled"));
    process.exit(0);
  }
  return value as T;
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

export async function runWizard(defaultName?: string): Promise<WizardAnswers> {
  p.intro(pc.bgCyan(pc.black(` ${t("intro")} `)));

  // 1. Project name
  const projectName = guard(
    await p.text({
      message: t("projectName"),
      placeholder: t("projectNamePlaceholder"),
      initialValue: defaultName ?? "",
      validate(value) {
        if (!value.trim()) return "Required";
        if (value.length > 100) return "Must be 100 characters or fewer";
        if (!/^[a-z0-9][a-z0-9._-]*$/.test(value)) {
          return "Must start with lowercase letter/number, then lowercase letters, numbers, dots, hyphens, or underscores";
        }
        return undefined;
      },
    }),
  );

  // 2. AI agent tools
  const agents = guard(
    await p.multiselect<AgentPresetName>({
      message: t("agents"),
      options: [
        { value: "amazon-q", label: t("agent.amazon-q") },
        { value: "claude-code", label: t("agent.claude-code") },
        { value: "copilot", label: t("agent.copilot") },
      ],
      required: false,
    }),
  );

  // 3. IaC
  const iac = guard(
    await p.select<IacPresetName>({
      message: t("iac"),
      options: [
        { value: "cdk", label: t("iac.cdk") },
        { value: "terraform", label: t("iac.terraform") },
      ],
    }),
  );

  // 4. Compute + sub-options
  const compute = guard(
    await p.multiselect<ComputePresetName>({
      message: t("compute"),
      options: [
        { value: "lambda", label: t("compute.lambda") },
        { value: "ecs", label: t("compute.ecs") },
        { value: "eks", label: t("compute.eks") },
        { value: "ec2", label: t("compute.ec2") },
      ],
      required: false,
    }),
  );

  let lambdaOptions: LambdaOptions | undefined;
  let ecsOptions: EcsOptions | undefined;
  let eksOptions: EksOptions | undefined;
  let ec2Options: Ec2Options | undefined;

  if (compute.includes("lambda")) {
    lambdaOptions = await askLambdaOptions();
  }
  if (compute.includes("ecs")) {
    ecsOptions = await askEcsOptions();
  }
  if (compute.includes("eks")) {
    eksOptions = await askEksOptions();
  }
  if (compute.includes("ec2")) {
    ec2Options = await askEc2Options();
  }

  // 5. AI + sub-options
  const ai = guard(
    await p.multiselect<AiPresetName>({
      message: t("ai"),
      options: [
        { value: "bedrock", label: t("ai.bedrock") },
        { value: "bedrock-kb", label: t("ai.bedrock-kb") },
        { value: "bedrock-agents", label: t("ai.bedrock-agents") },
        { value: "opensearch", label: t("ai.opensearch") },
      ],
      required: false,
    }),
  );

  let openSearchOptions: OpenSearchOptions | undefined;

  if (ai.includes("opensearch")) {
    openSearchOptions = await askOpenSearchOptions();
  }

  // 6. Data & Storage + sub-options
  const data = guard(
    await p.multiselect<DataPresetName>({
      message: t("data"),
      options: [
        { value: "s3", label: t("data.s3") },
        { value: "dynamodb", label: t("data.dynamodb") },
        { value: "aurora", label: t("data.aurora") },
        { value: "rds", label: t("data.rds") },
      ],
      required: false,
    }),
  );

  let auroraOptions: AuroraOptions | undefined;
  let rdsOptions: RdsOptions | undefined;

  if (data.includes("aurora")) {
    auroraOptions = await askAuroraOptions();
  }
  if (data.includes("rds")) {
    rdsOptions = await askRdsOptions();
  }

  // 7. Data Pipeline & Analytics
  const dataPipeline = guard(
    await p.multiselect<DataPipelinePresetName>({
      message: t("dataPipeline"),
      options: [
        { value: "kinesis", label: t("dataPipeline.kinesis") },
        { value: "glue", label: t("dataPipeline.glue") },
        { value: "redshift", label: t("dataPipeline.redshift") },
      ],
      required: false,
    }),
  );

  let redshiftOptions: RedshiftOptions | undefined;

  if (dataPipeline.includes("redshift")) {
    redshiftOptions = await askRedshiftOptions();
  }

  // 8. Application Integration
  const integration = guard(
    await p.multiselect<IntegrationPresetName>({
      message: t("integration"),
      options: [
        { value: "sqs", label: t("integration.sqs") },
        { value: "sns", label: t("integration.sns") },
        { value: "eventbridge", label: t("integration.eventbridge") },
        { value: "step-functions", label: t("integration.step-functions") },
      ],
      required: false,
    }),
  );

  // 8. Networking & API + sub-options
  const networking = guard(
    await p.multiselect<NetworkingPresetName>({
      message: t("networking"),
      options: [
        { value: "api-gateway", label: t("networking.api-gateway") },
        { value: "cloudfront", label: t("networking.cloudfront") },
      ],
      required: false,
    }),
  );

  let apiGatewayOptions: ApiGatewayOptions | undefined;

  if (networking.includes("api-gateway")) {
    apiGatewayOptions = await askApiGatewayOptions();
  }

  // 9. Security & Identity
  const security = guard(
    await p.multiselect<SecurityPresetName>({
      message: t("security"),
      options: [{ value: "cognito", label: t("security.cognito") }],
      required: false,
    }),
  );

  // 10. Observability
  const observability = guard(
    await p.multiselect<ObservabilityPresetName>({
      message: t("observability"),
      options: [{ value: "cloudwatch", label: t("observability.cloudwatch") }],
      required: false,
    }),
  );

  // Auto-resolve VPC if needed
  notifyVpcAutoResolution(compute, data, openSearchOptions, redshiftOptions);

  // 11. Languages (auto-resolved ones excluded)
  const autoLanguages = resolveAutoLanguages(iac);
  const languages = await askLanguages(autoLanguages);

  return {
    projectName,
    agents,
    iac,
    compute,
    ai,
    data,
    dataPipeline,
    integration,
    networking,
    security,
    observability,
    languages,
    lambdaOptions,
    ecsOptions,
    eksOptions,
    ec2Options,
    auroraOptions,
    rdsOptions,
    openSearchOptions,
    redshiftOptions,
    apiGatewayOptions,
  };
}

// ---------------------------------------------------------------------------
// Sub-option prompts
// ---------------------------------------------------------------------------

async function askLambdaOptions(): Promise<LambdaOptions> {
  const vpcPlacement = guard(
    await p.select<boolean>({
      message: t("lambda.vpcPlacement"),
      options: [
        { value: false, label: t("no") },
        { value: true, label: t("yes") },
      ],
    }),
  );
  return { vpcPlacement };
}

async function askEcsOptions(): Promise<EcsOptions> {
  const launchType = guard(
    await p.select<EcsLaunchType>({
      message: t("ecs.launchType"),
      options: [
        { value: "fargate", label: t("ecs.launchType.fargate") },
        { value: "managed-instances", label: t("ecs.launchType.managed-instances") },
        { value: "ec2", label: t("ecs.launchType.ec2") },
      ],
    }),
  );
  const loadBalancer = await askLoadBalancer(t("ecs.loadBalancer"));
  return { launchType, loadBalancer };
}

async function askEksOptions(): Promise<EksOptions> {
  const mode = guard(
    await p.select<EksMode>({
      message: t("eks.mode"),
      options: [
        { value: "auto-mode", label: t("eks.mode.auto-mode") },
        { value: "fargate", label: t("eks.mode.fargate") },
        { value: "managed-node-group", label: t("eks.mode.managed-node-group") },
      ],
    }),
  );
  const loadBalancer = await askLoadBalancer(t("eks.loadBalancer"));
  return { mode, loadBalancer };
}

async function askEc2Options(): Promise<Ec2Options> {
  const loadBalancer = await askLoadBalancer(t("ec2.loadBalancer"));
  return { loadBalancer };
}

async function askLoadBalancer(message: string): Promise<LoadBalancerType> {
  return guard(
    await p.select<LoadBalancerType>({
      message,
      options: [
        { value: "alb", label: t("lb.alb") },
        { value: "nlb", label: t("lb.nlb") },
        { value: "none", label: t("lb.none") },
      ],
    }),
  );
}

async function askAuroraOptions(): Promise<AuroraOptions> {
  const capacity = guard(
    await p.select<AuroraCapacity>({
      message: t("aurora.capacity"),
      options: [
        { value: "serverless-v2", label: t("aurora.capacity.serverless-v2") },
        { value: "provisioned", label: t("aurora.capacity.provisioned") },
      ],
    }),
  );
  const engine = guard(
    await p.select<AuroraEngine>({
      message: t("aurora.engine"),
      options: [
        { value: "mysql", label: t("aurora.engine.mysql") },
        { value: "postgresql", label: t("aurora.engine.postgresql") },
      ],
    }),
  );
  return { capacity, engine };
}

async function askRdsOptions(): Promise<RdsOptions> {
  const engine = guard(
    await p.select<RdsEngine>({
      message: t("rds.engine"),
      options: [
        { value: "mysql", label: t("rds.engine.mysql") },
        { value: "postgresql", label: t("rds.engine.postgresql") },
      ],
    }),
  );
  return { engine };
}

async function askRedshiftOptions(): Promise<RedshiftOptions> {
  const mode = guard(
    await p.select<RedshiftMode>({
      message: t("redshift.mode"),
      options: [
        { value: "serverless", label: t("redshift.mode.serverless") },
        { value: "provisioned", label: t("redshift.mode.provisioned") },
      ],
    }),
  );
  return { mode };
}

async function askOpenSearchOptions(): Promise<OpenSearchOptions> {
  const mode = guard(
    await p.select<OpenSearchMode>({
      message: t("opensearch.mode"),
      options: [
        { value: "serverless", label: t("opensearch.mode.serverless") },
        { value: "managed-cluster", label: t("opensearch.mode.managed-cluster") },
      ],
    }),
  );
  return { mode };
}

async function askApiGatewayOptions(): Promise<ApiGatewayOptions> {
  const type = guard(
    await p.select<"rest" | "http">({
      message: t("apiGateway.type"),
      options: [
        { value: "rest", label: t("apiGateway.type.rest") },
        { value: "http", label: t("apiGateway.type.http") },
      ],
    }),
  );
  return { type };
}

// ---------------------------------------------------------------------------
// Auto-resolution
// ---------------------------------------------------------------------------

const VPC_TRIGGERS: ReadonlySet<string> = new Set([
  "ecs",
  "eks",
  "ec2",
  "aurora",
  "rds",
  "redshift",
]);

export function notifyVpcAutoResolution(
  compute: readonly ComputePresetName[],
  data: readonly DataPresetName[],
  openSearchOptions?: OpenSearchOptions,
  redshiftOptions?: RedshiftOptions,
): void {
  const trigger = [...compute, ...data].find((s) => VPC_TRIGGERS.has(s));
  if (trigger) {
    p.log.info(pc.dim(t("autoResolvedVpc", { service: trigger.toUpperCase() })));
  } else if (openSearchOptions?.mode === "managed-cluster") {
    p.log.info(pc.dim(t("autoResolvedVpc", { service: "OPENSEARCH" })));
  } else if (redshiftOptions) {
    p.log.info(pc.dim(t("autoResolvedVpc", { service: "REDSHIFT" })));
  }
}

export function resolveAutoLanguages(iac: IacPresetName): Set<LanguagePresetName> {
  const auto = new Set<LanguagePresetName>();
  if (iac === "cdk") {
    auto.add("typescript");
    p.log.info(pc.dim(t("autoResolvedTypescript")));
  }
  return auto;
}

async function askLanguages(autoResolved: Set<LanguagePresetName>): Promise<LanguagePresetName[]> {
  const allLanguages: LanguagePresetName[] = ["typescript", "python"];
  const remaining = allLanguages.filter((l) => !autoResolved.has(l));

  if (remaining.length === 0) {
    p.log.info(pc.dim(t("skippedLanguages")));
    return [...autoResolved];
  }

  const selected = guard(
    await p.multiselect<LanguagePresetName>({
      message: t("languages"),
      options: remaining.map((l) => ({
        value: l,
        label: t(`language.${l}`),
      })),
      required: false,
    }),
  );

  return [...autoResolved, ...selected];
}
