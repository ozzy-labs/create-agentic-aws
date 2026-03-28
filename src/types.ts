import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/** Recursively makes all properties optional. */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ---------------------------------------------------------------------------
// Preset names (string literal union)
// ---------------------------------------------------------------------------

export type AgentPresetName = "amazon-q" | "claude-code" | "copilot";

export type IacPresetName = "cdk" | "terraform";

export type ComputePresetName = "lambda" | "ecs" | "eks" | "ec2";

export type AiPresetName = "bedrock" | "bedrock-kb" | "bedrock-agents" | "opensearch";

export type DataPresetName = "s3" | "dynamodb" | "aurora" | "rds";

export type IntegrationPresetName = "sqs" | "sns" | "eventbridge" | "step-functions";

export type NetworkingPresetName = "api-gateway" | "cloudfront";

export type SecurityPresetName = "cognito";

export type ObservabilityPresetName = "cloudwatch";

export type LanguagePresetName = "typescript" | "python";

export type InfraPresetName = "vpc";

export type PresetName =
  | "base"
  | AgentPresetName
  | IacPresetName
  | ComputePresetName
  | AiPresetName
  | DataPresetName
  | IntegrationPresetName
  | NetworkingPresetName
  | SecurityPresetName
  | ObservabilityPresetName
  | LanguagePresetName
  | InfraPresetName;

// ---------------------------------------------------------------------------
// Wizard sub-options
// ---------------------------------------------------------------------------

export type EcsLaunchType = "fargate" | "managed-instances" | "ec2";

export type EksMode = "auto-mode" | "fargate" | "managed-node-group";

export type LoadBalancerType = "alb" | "nlb" | "none";

export type AuroraCapacity = "serverless-v2" | "provisioned";

export type AuroraEngine = "mysql" | "postgresql";

export type RdsEngine = "mysql" | "postgresql";

export type ApiGatewayType = "rest" | "http";

export interface EcsOptions {
  readonly launchType: EcsLaunchType;
  readonly loadBalancer: LoadBalancerType;
}

export interface EksOptions {
  readonly mode: EksMode;
  readonly loadBalancer: LoadBalancerType;
}

export interface Ec2Options {
  readonly loadBalancer: LoadBalancerType;
}

export interface LambdaOptions {
  readonly vpcPlacement: boolean;
}

export interface AuroraOptions {
  readonly capacity: AuroraCapacity;
  readonly engine: AuroraEngine;
}

export interface RdsOptions {
  readonly engine: RdsEngine;
}

export type OpenSearchMode = "serverless" | "managed-cluster";

export interface OpenSearchOptions {
  readonly mode: OpenSearchMode;
}

export interface ApiGatewayOptions {
  readonly type: ApiGatewayType;
}

// ---------------------------------------------------------------------------
// Wizard answers
// ---------------------------------------------------------------------------

export interface WizardAnswers {
  readonly projectName: string;
  readonly agents: readonly AgentPresetName[];
  readonly iac: IacPresetName;
  readonly compute: readonly ComputePresetName[];
  readonly ai: readonly AiPresetName[];
  readonly data: readonly DataPresetName[];
  readonly integration: readonly IntegrationPresetName[];
  readonly networking: readonly NetworkingPresetName[];
  readonly security: readonly SecurityPresetName[];
  readonly observability: readonly ObservabilityPresetName[];
  readonly languages: readonly LanguagePresetName[];

  // Sub-options (present only when the parent service is selected)
  readonly ecsOptions?: EcsOptions;
  readonly eksOptions?: EksOptions;
  readonly ec2Options?: Ec2Options;
  readonly lambdaOptions?: LambdaOptions;
  readonly auroraOptions?: AuroraOptions;
  readonly rdsOptions?: RdsOptions;
  readonly openSearchOptions?: OpenSearchOptions;
  readonly apiGatewayOptions?: ApiGatewayOptions;
}

// ---------------------------------------------------------------------------
// Markdown section injection
// ---------------------------------------------------------------------------

export interface MarkdownSection {
  /** Heading text to match (e.g. "## Tech Stack"). */
  readonly heading: string;
  /** Content to inject under the heading. */
  readonly content: string;
}

// ---------------------------------------------------------------------------
// CI contribution
// ---------------------------------------------------------------------------

export interface CiContribution {
  /** Steps to add to the lint job. */
  readonly lintSteps?: readonly CiStep[];
  /** Steps to add to the test job. */
  readonly testSteps?: readonly CiStep[];
  /** Steps to add to the build job. */
  readonly buildSteps?: readonly CiStep[];
}

export interface CiStep {
  readonly name: string;
  readonly run: string;
}

// ---------------------------------------------------------------------------
// MCP server configuration
// ---------------------------------------------------------------------------

export interface McpServerConfig {
  /** MCP server command (e.g. "npx"). */
  readonly command: string;
  /** Command arguments. */
  readonly args: readonly string[];
  /** Optional environment variables. */
  readonly env?: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// Preset interface
// ---------------------------------------------------------------------------

export interface IacContribution {
  /** Owned files within infra/ (path → content). */
  readonly files: Readonly<Record<string, string>>;
  /** Merge contributions to shared IaC files (e.g. app-stack.ts, variables.tf). */
  readonly merge?: Readonly<Record<string, unknown>>;
}

export interface Preset {
  readonly name: PresetName;

  /** Presets that must be included (auto-resolved). */
  readonly requires?: readonly PresetName[];

  /** Owned files (path → content). No other preset writes to these paths. */
  readonly files: Readonly<Record<string, string>>;

  /** Merge contributions to shared files (deep-merged). */
  readonly merge: Readonly<Record<string, unknown>>;

  /** IaC-specific contributions keyed by IaC type. */
  readonly iacContributions?: {
    readonly cdk?: IacContribution;
    readonly terraform?: IacContribution;
  };

  /** Markdown section injections keyed by file path (e.g. "README.md"). */
  readonly markdown?: Readonly<Record<string, readonly MarkdownSection[]>>;

  /** CI workflow step contributions. */
  readonly ciSteps?: CiContribution;

  /** Extra shell commands for setup script. */
  readonly setupExtra?: string;

  /** MCP servers to register in agent config files. */
  readonly mcpServers?: Readonly<Record<string, McpServerConfig>>;
}

// ---------------------------------------------------------------------------
// Generate result
// ---------------------------------------------------------------------------

export class GenerateResult {
  /** All generated files (relative path → content). */
  readonly files: ReadonlyMap<string, string>;

  constructor(files: ReadonlyMap<string, string>) {
    this.files = files;
  }

  /** Check whether a file exists in the output. */
  hasFile(path: string): boolean {
    return this.files.has(path);
  }

  /** Read a file as raw text. Returns undefined if not found. */
  readText(path: string): string | undefined {
    return this.files.get(path);
  }

  /** Read and parse a file as JSON. Throws if not found or invalid. */
  readJson<T = unknown>(path: string): T {
    const text = this.files.get(path);
    if (text === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return JSON.parse(text) as T;
  }

  /** Read and parse a file as YAML. Throws if not found or invalid. */
  readYaml<T = unknown>(path: string): T {
    const text = this.files.get(path);
    if (text === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return parseYaml(text) as T;
  }

  /** Read and parse a file as TOML. Throws if not found or invalid. */
  readToml<T = unknown>(path: string): T {
    const text = this.files.get(path);
    if (text === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return parseToml(text) as T;
  }
}
