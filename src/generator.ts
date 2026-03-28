import { mergeFile, mergeMarkdown } from "./merge.js";
import {
  OPENSEARCH_MANAGED_CONSTRUCT,
  OPENSEARCH_MANAGED_TF,
  OPENSEARCH_MANAGED_TF_OUTPUTS,
} from "./presets/opensearch.js";
import {
  REDSHIFT_PROVISIONED_CONSTRUCT,
  REDSHIFT_PROVISIONED_TF,
  REDSHIFT_PROVISIONED_TF_OUTPUTS,
} from "./presets/redshift.js";
import { readTemplates } from "./presets/templates.js";
import type {
  IacPresetName,
  MarkdownSection,
  McpServerConfig,
  Preset,
  PresetName,
  WizardAnswers,
} from "./types.js";
import { GenerateResult } from "./types.js";

// ---------------------------------------------------------------------------
// Canonical preset application order
// ---------------------------------------------------------------------------

// Ensures deterministic preset composition — later presets can rely on earlier ones' files.
const PRESET_ORDER: readonly PresetName[] = [
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

// Presets that auto-resolve VPC
const VPC_TRIGGERS: ReadonlySet<PresetName> = new Set([
  "ecs",
  "eks",
  "ec2",
  "aurora",
  "rds",
  "redshift",
]);

// ---------------------------------------------------------------------------
// Preset resolution
// ---------------------------------------------------------------------------

export function resolvePresets(
  answers: WizardAnswers,
  registry: ReadonlyMap<PresetName, Preset>,
): Preset[] {
  const selected = new Set<PresetName>();

  // Always include base
  selected.add("base");

  // Collect from wizard answers
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

  // Auto-resolve VPC
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

  // Resolve transitive dependencies (requires) — fixed-point
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

  // Sort by canonical order
  return PRESET_ORDER.filter((name) => resolved.has(name))
    .map((name) => registry.get(name))
    .filter((p): p is Preset => p !== undefined);
}

// ---------------------------------------------------------------------------
// Variable substitution
// ---------------------------------------------------------------------------

function substituteVars(content: string, vars: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

function defaultEmptyContent(path: string): string {
  if (path.endsWith(".json") || path.endsWith(".jsonc")) return "{}";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "";
  if (path.endsWith(".toml")) return "";
  return "";
}

// ---------------------------------------------------------------------------
// Generator pipeline
// ---------------------------------------------------------------------------

export function generate(
  answers: WizardAnswers,
  registry: ReadonlyMap<PresetName, Preset>,
): GenerateResult {
  const presets = resolvePresets(answers, registry);
  const vars = { projectName: answers.projectName };
  const files = new Map<string, string>();

  // --- Step 1: Collect owned files (with variable substitution) ---
  for (const preset of presets) {
    for (const [path, content] of Object.entries(preset.files)) {
      files.set(path, substituteVars(content, vars));
    }
  }

  // --- Step 2: IaC contributions ---
  collectIacContributions(presets, answers.iac, files, vars);

  // --- Step 2.5: Lambda VPC placement ---
  if (answers.lambdaOptions?.vpcPlacement) {
    applyLambdaVpcPlacement(answers.iac, files);
  }

  // --- Step 2.6: RDS engine option ---
  if (answers.rdsOptions?.engine === "mysql") {
    applyRdsEngineOption(answers.iac, files);
  }

  // --- Step 2.7: OpenSearch managed-cluster mode ---
  if (answers.openSearchOptions?.mode === "managed-cluster") {
    applyOpenSearchManagedMode(answers.iac, files);
  }

  // --- Step 2.8: Bedrock KB + OpenSearch wiring ---
  const presetNames = new Set(presets.map((p) => p.name));
  if (presetNames.has("bedrock-kb") && presetNames.has("opensearch")) {
    applyBedrockKbOpenSearchWiring(answers, files);
  }

  // --- Step 2.9: Redshift provisioned mode ---
  if (answers.redshiftOptions?.mode === "provisioned") {
    applyRedshiftProvisionedMode(answers.iac, files);
  }

  // --- Step 2.10: Lambda Python runtime ---
  if (presetNames.has("lambda") && presetNames.has("python") && !presetNames.has("typescript")) {
    applyLambdaPythonRuntime(files, vars);
  }

  // --- Step 2.11: DynamoDB → Lambda integration (Terraform) ---
  if (presetNames.has("dynamodb") && presetNames.has("lambda")) {
    applyDynamoDbLambdaIntegration(answers.iac, files);
  }

  // --- Step 2.12: Ensure tsconfig.json base when presets contribute to it ---
  ensureTsconfigBase(presets, files);

  // --- Step 3: Shared file deep merge ---
  mergeSharedFiles(presets, files, vars);

  // --- Step 3.5: Lambda Python dependency swap ---
  if (presetNames.has("lambda") && presetNames.has("python") && !presetNames.has("typescript")) {
    applyLambdaPythonDeps(files);
  }

  // --- Step 4: MCP server distribution ---
  distributeMcpServers(presets, answers, files);

  // --- Step 5: Markdown template expansion ---
  expandMarkdownTemplates(presets, files);

  // --- Step 5.5: RDS engine label in README ---
  if (answers.rdsOptions?.engine === "mysql") {
    const readme = files.get("README.md");
    if (readme) {
      files.set(
        "README.md",
        readme.replace("PostgreSQL relational database", "MySQL relational database"),
      );
    }
  }

  // --- Step 5.6: Lambda Python label in README ---
  if (presetNames.has("lambda") && presetNames.has("python") && !presetNames.has("typescript")) {
    const readme = files.get("README.md");
    if (readme) {
      files.set(
        "README.md",
        readme
          .replace("Serverless compute (Node.js 24)", "Serverless compute (Python 3.12)")
          .replace(
            "Structured logging, metrics, tracing",
            "Structured logging, metrics, tracing (Python)",
          ),
      );
    }
  }

  // --- Step 5.7: OpenSearch managed-cluster label in README ---
  if (answers.openSearchOptions?.mode === "managed-cluster") {
    const readme = files.get("README.md");
    if (readme) {
      files.set(
        "README.md",
        readme.replace(
          "**Amazon OpenSearch Serverless**: Serverless search and analytics collection",
          "**Amazon OpenSearch Service**: Managed search and analytics cluster (VPC)",
        ),
      );
    }
  }

  // --- Step 5.8: Redshift provisioned label in README ---
  if (answers.redshiftOptions?.mode === "provisioned") {
    const readme = files.get("README.md");
    if (readme) {
      files.set(
        "README.md",
        readme.replace(
          "Serverless data warehouse (namespace + workgroup)",
          "Provisioned data warehouse cluster",
        ),
      );
    }
  }

  // --- Step 6: Strip merge markers from generated .ts files ---
  stripMergeMarkers(files);

  return new GenerateResult(files);
}

// ---------------------------------------------------------------------------
// Step 2: IaC contributions
// ---------------------------------------------------------------------------

function collectIacContributions(
  presets: readonly Preset[],
  iac: IacPresetName,
  files: Map<string, string>,
  vars: Record<string, string>,
): void {
  // Collect IaC merge contributions grouped by path
  const iacMergeContributions = new Map<string, unknown[]>();

  for (const preset of presets) {
    const contribution = preset.iacContributions?.[iac];
    if (!contribution) continue;

    // Add IaC owned files
    for (const [path, content] of Object.entries(contribution.files)) {
      files.set(path, substituteVars(content, vars));
    }

    // Collect IaC merge contributions
    if (contribution.merge) {
      for (const [path, patch] of Object.entries(contribution.merge)) {
        const existing = iacMergeContributions.get(path) ?? [];
        existing.push(patch);
        iacMergeContributions.set(path, existing);
      }
    }
  }

  // Apply IaC merge contributions
  for (const [path, patches] of iacMergeContributions) {
    const base = files.get(path) ?? defaultEmptyContent(path);
    files.set(path, mergeFile(path, base, patches));
  }
}

// ---------------------------------------------------------------------------
// Step 2.5: Lambda VPC placement
// ---------------------------------------------------------------------------

function applyLambdaVpcPlacement(iac: IacPresetName, files: Map<string, string>): void {
  if (iac === "cdk") {
    const appStack = files.get("infra/lib/app-stack.ts");
    if (appStack) {
      files.set(
        "infra/lib/app-stack.ts",
        appStack.replace(
          'new LambdaFunction(this, "LambdaFunction")',
          'new LambdaFunction(this, "LambdaFunction", { vpc: vpc.vpc })',
        ),
      );
    }
  } else {
    const lambdaTf = files.get("infra/lambda.tf");
    if (lambdaTf) {
      const vpcConfig = `
resource "aws_security_group" "lambda" {
  name_prefix = "\${var.project_name}-lambda-"
  vpc_id      = aws_vpc.this.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
`;
      // Insert vpc_config block and VPC execution role policy
      let patched = lambdaTf.replace(
        "  environment {",
        `  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {`,
      );
      patched = patched.replace(
        'resource "aws_iam_role_policy_attachment" "lambda_basic" {',
        `resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {`,
      );
      files.set("infra/lambda.tf", patched + vpcConfig);
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2.6: RDS engine option (PostgreSQL → MySQL)
// ---------------------------------------------------------------------------

function applyRdsEngineOption(iac: IacPresetName, files: Map<string, string>): void {
  if (iac === "cdk") {
    const construct = files.get("infra/lib/constructs/rds.ts");
    if (construct) {
      files.set(
        "infra/lib/constructs/rds.ts",
        construct.replace(
          "engine: rds.DatabaseInstanceEngine.postgres({\n        version: rds.PostgresEngineVersion.VER_16_4,\n      })",
          "engine: rds.DatabaseInstanceEngine.mysql({\n        version: rds.MysqlEngineVersion.VER_8_0_40,\n      })",
        ),
      );
    }
  } else {
    const tf = files.get("infra/rds.tf");
    if (tf) {
      files.set(
        "infra/rds.tf",
        tf
          .replace('engine         = "postgres"', 'engine         = "mysql"')
          .replace('engine_version = "16.4"', 'engine_version = "8.0.40"')
          .replace("from_port   = 5432", "from_port   = 3306")
          .replace("to_port     = 5432", "to_port     = 3306"),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2.7: OpenSearch managed-cluster mode (Serverless → Managed Cluster)
// ---------------------------------------------------------------------------

function applyOpenSearchManagedMode(iac: IacPresetName, files: Map<string, string>): void {
  if (iac === "cdk") {
    files.set("infra/lib/constructs/opensearch.ts", OPENSEARCH_MANAGED_CONSTRUCT);
    const appStack = files.get("infra/lib/app-stack.ts");
    if (appStack) {
      files.set(
        "infra/lib/app-stack.ts",
        appStack
          .replace(
            'import { OpenSearchCollection } from "./constructs/opensearch";',
            'import { OpenSearchDomain } from "./constructs/opensearch";',
          )
          .replace(
            '    new OpenSearchCollection(this, "OpenSearchCollection");',
            '    new OpenSearchDomain(this, "OpenSearchDomain", { vpc: vpc.vpc });',
          ),
      );
    }
  } else {
    files.set("infra/opensearch.tf", OPENSEARCH_MANAGED_TF);
    // Replace serverless outputs with managed outputs
    const outputs = files.get("infra/outputs.tf");
    if (outputs) {
      files.set(
        "infra/outputs.tf",
        outputs.replace(
          /output "opensearch_collection_endpoint"[\s\S]*?}\n\noutput "opensearch_collection_arn"[\s\S]*?}\n/,
          OPENSEARCH_MANAGED_TF_OUTPUTS,
        ),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2.8: Bedrock KB + OpenSearch ARN wiring
// ---------------------------------------------------------------------------

function applyBedrockKbOpenSearchWiring(answers: WizardAnswers, files: Map<string, string>): void {
  const isServerless = answers.openSearchOptions?.mode !== "managed-cluster";

  if (answers.iac === "cdk") {
    const appStack = files.get("infra/lib/app-stack.ts");
    if (appStack) {
      const arnRef = isServerless
        ? "opensearchCollection.collection.attrArn"
        : "opensearchDomain.domain.domainArn";
      const varName = isServerless ? "opensearchCollection" : "opensearchDomain";
      const constructClass = isServerless ? "OpenSearchCollection" : "OpenSearchDomain";
      let patched = appStack
        .replace(
          `    new ${constructClass}(this,`,
          `    const ${varName} = new ${constructClass}(this,`,
        )
        .replace(
          '{ collectionArn: "TODO: Set your OpenSearch Serverless collection ARN" }',
          `{ collectionArn: ${arnRef} }`,
        );

      // Move the OpenSearch construct line before BedrockKnowledgeBase so the
      // variable is declared before it is referenced.
      const lines = patched.split("\n");
      const osIdx = lines.findIndex((l) => l.includes(`const ${varName} = new ${constructClass}(`));
      const kbIdx = lines.findIndex((l) => l.includes("new BedrockKnowledgeBase("));
      if (osIdx !== -1 && kbIdx !== -1 && osIdx > kbIdx) {
        const [osLine] = lines.splice(osIdx, 1);
        lines.splice(kbIdx, 0, osLine);
        patched = lines.join("\n");
      }

      files.set("infra/lib/app-stack.ts", patched);
    }
  } else {
    const kbTf = files.get("infra/bedrock-kb.tf");
    if (kbTf) {
      if (isServerless) {
        files.set(
          "infra/bedrock-kb.tf",
          kbTf.replace(
            'collection_arn    = "TODO: Set your OpenSearch Serverless collection ARN"',
            "collection_arn    = aws_opensearchserverless_collection.this.arn",
          ),
        );
      } else {
        files.set(
          "infra/bedrock-kb.tf",
          kbTf
            .replace('type = "OPENSEARCH_SERVERLESS"', 'type = "OPENSEARCH_MANAGED_CLUSTER"')
            .replace(
              "opensearch_serverless_configuration",
              "opensearch_managed_cluster_configuration",
            )
            .replace(
              'collection_arn    = "TODO: Set your OpenSearch Serverless collection ARN"',
              "domain_arn        = aws_opensearch_domain.this.arn",
            ),
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2.9: Redshift provisioned mode (Serverless → Provisioned)
// ---------------------------------------------------------------------------

function applyRedshiftProvisionedMode(iac: IacPresetName, files: Map<string, string>): void {
  if (iac === "cdk") {
    files.set("infra/lib/constructs/redshift.ts", REDSHIFT_PROVISIONED_CONSTRUCT);
    const appStack = files.get("infra/lib/app-stack.ts");
    if (appStack) {
      files.set(
        "infra/lib/app-stack.ts",
        appStack
          .replace(
            'import { RedshiftServerless } from "./constructs/redshift";',
            'import { RedshiftCluster } from "./constructs/redshift";',
          )
          .replace(
            '    new RedshiftServerless(this, "RedshiftServerless", { vpc: vpc.vpc });',
            '    new RedshiftCluster(this, "RedshiftCluster", { vpc: vpc.vpc });',
          ),
      );
    }
  } else {
    files.set("infra/redshift.tf", REDSHIFT_PROVISIONED_TF);
    const outputs = files.get("infra/outputs.tf");
    if (outputs) {
      files.set(
        "infra/outputs.tf",
        outputs.replace(
          /output "redshift_workgroup_endpoint"[\s\S]*?}\n\noutput "redshift_namespace_name"[\s\S]*?}\n/,
          REDSHIFT_PROVISIONED_TF_OUTPUTS,
        ),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2.11: DynamoDB → Lambda integration (Terraform)
// ---------------------------------------------------------------------------

function applyDynamoDbLambdaIntegration(iac: IacPresetName, files: Map<string, string>): void {
  if (iac === "cdk") return; // CDK uses grantLambdaAccess() in app-stack.ts

  const lambdaTf = files.get("infra/lambda.tf");
  if (!lambdaTf) return;

  // Add TABLE_NAME environment variable
  const patched = lambdaTf.replace(
    '      NODE_OPTIONS = "--enable-source-maps"',
    `      NODE_OPTIONS = "--enable-source-maps"
      TABLE_NAME   = aws_dynamodb_table.this.name`,
  );

  // Append IAM policy for DynamoDB access
  const dynamoDbPolicy = `
resource "aws_iam_role_policy" "lambda_dynamodb" {
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
      ]
      Resource = [
        aws_dynamodb_table.this.arn,
        "\${aws_dynamodb_table.this.arn}/index/*",
      ]
    }]
  })
}
`;

  files.set("infra/lambda.tf", patched + dynamoDbPolicy);
}

// ---------------------------------------------------------------------------
// Step 2.9: Lambda Python runtime (TypeScript → Python)
// ---------------------------------------------------------------------------

const LAMBDA_PYTHON_TF_RUNTIME = `  handler          = "handler.handler"
  runtime          = "python3.12"`;

const LAMBDA_PYTHON_TF_ENV = `  environment {
    variables = {
      POWERTOOLS_SERVICE_NAME = var.project_name
    }
  }`;

function applyLambdaPythonRuntime(files: Map<string, string>, vars: Record<string, string>): void {
  // Replace TypeScript handler files with Python handler
  files.delete("lambda/handlers/index.ts");
  files.delete("lambda/powertools.ts");
  files.delete("lib/observability/middleware.ts");
  files.delete("lib/observability/index.ts");

  const pythonTemplates = readTemplates("lambda-python");
  for (const [path, content] of Object.entries(pythonTemplates)) {
    files.set(path, substituteVars(content, vars));
  }

  // Update Terraform lambda.tf: swap runtime, handler, and remove esbuild build step
  const tf = files.get("infra/lambda.tf");
  if (tf) {
    let patched = tf
      .replace(
        '  handler          = "index.handler"\n  runtime          = "nodejs24.x"',
        LAMBDA_PYTHON_TF_RUNTIME,
      )
      .replace(
        `  environment {\n    variables = {\n      NODE_OPTIONS = "--enable-source-maps"\n    }\n  }`,
        LAMBDA_PYTHON_TF_ENV,
      );

    // Replace esbuild build step + single-file archive with directory archive
    patched = patched
      .replace(/resource "null_resource" "lambda_build" \{[\s\S]*?\n\}\n\n/, "")
      .replace(
        /data "archive_file" "lambda" \{[\s\S]*?\n\}/,
        `data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "\${path.module}/../lambda/handlers"
  output_path = "\${path.module}/.build/lambda.zip"
}`,
      );

    files.set("infra/lambda.tf", patched);
  }
}

// ---------------------------------------------------------------------------
// Step 3.5: Lambda Python dependency swap
// ---------------------------------------------------------------------------

/** npm Lambda Powertools packages to remove from package.json for Python projects. */
const LAMBDA_NPM_DEPS = [
  "@aws-lambda-powertools/logger",
  "@aws-lambda-powertools/metrics",
  "@aws-lambda-powertools/tracer",
  "@middy/core",
];
const LAMBDA_NPM_DEV_DEPS = ["@types/aws-lambda"];

function applyLambdaPythonDeps(files: Map<string, string>): void {
  // Remove npm Lambda deps from package.json
  const pkgRaw = files.get("package.json");
  if (pkgRaw) {
    const pkg = JSON.parse(pkgRaw) as Record<string, Record<string, unknown>>;
    if (pkg.dependencies) {
      for (const dep of LAMBDA_NPM_DEPS) delete pkg.dependencies[dep];
    }
    if (pkg.devDependencies) {
      for (const dep of LAMBDA_NPM_DEV_DEPS) delete pkg.devDependencies[dep];
    }
    files.set("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  }

  // Remove Lambda includes from tsconfig.json if present
  files.delete("tsconfig.json");

  // Add aws-lambda-powertools to pyproject.toml
  const toml = files.get("pyproject.toml");
  if (toml) {
    files.set(
      "pyproject.toml",
      toml.replace(
        'requires-python = ">=3.12"',
        'requires-python = ">=3.12"\ndependencies = ["aws-lambda-powertools>=3"]',
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Step 2.12: Ensure tsconfig.json base template exists
// ---------------------------------------------------------------------------

function ensureTsconfigBase(presets: readonly Preset[], files: Map<string, string>): void {
  if (files.has("tsconfig.json")) return;

  const hasTsconfigMerge = presets.some((p) => "tsconfig.json" in p.merge);
  if (!hasTsconfigMerge) return;

  // Insert base tsconfig from typescript template so merge contributions
  // have proper compilerOptions, exclude, etc.
  const tsconfigTemplate = readTemplates("typescript")["tsconfig.json"];
  if (tsconfigTemplate) {
    files.set("tsconfig.json", tsconfigTemplate);
  }
}

// ---------------------------------------------------------------------------
// Step 3: Shared file deep merge
// ---------------------------------------------------------------------------

function mergeSharedFiles(
  presets: readonly Preset[],
  files: Map<string, string>,
  vars: Record<string, string>,
): void {
  // Group merge contributions by file path
  const contributions = new Map<string, unknown[]>();

  for (const preset of presets) {
    for (const [path, patch] of Object.entries(preset.merge)) {
      const existing = contributions.get(path) ?? [];
      existing.push(patch);
      contributions.set(path, existing);
    }
  }

  // Apply merge contributions
  for (const [path, patches] of contributions) {
    const base = files.get(path) ?? defaultEmptyContent(path);
    const merged = mergeFile(path, substituteVars(base, vars), patches);
    files.set(path, merged);
  }
}

// ---------------------------------------------------------------------------
// Step 4: MCP server distribution
// ---------------------------------------------------------------------------

/** Agent config file paths where MCP servers are registered. */
const AGENT_MCP_PATHS: Readonly<Record<string, string>> = {
  "claude-code": ".mcp.json",
  "amazon-q": ".amazonq/mcp.json",
  copilot: ".github/copilot-mcp.json",
};

function distributeMcpServers(
  presets: readonly Preset[],
  answers: WizardAnswers,
  files: Map<string, string>,
): void {
  // Collect all MCP servers from all presets
  const allServers: Record<string, McpServerConfig> = {};
  for (const preset of presets) {
    if (preset.mcpServers) {
      Object.assign(allServers, preset.mcpServers);
    }
  }

  if (Object.keys(allServers).length === 0) return;

  // Distribute to each selected agent's config
  // (skip claude-code — .mcp.json is user-specific; .mcp.json.example is generated below)
  for (const agent of answers.agents) {
    if (agent === "claude-code") continue;
    const configPath = AGENT_MCP_PATHS[agent];
    if (!configPath) continue;

    const raw = files.get(configPath);
    const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};

    const merged = {
      ...existing,
      mcpServers: {
        ...((existing.mcpServers as Record<string, unknown>) ?? {}),
        ...allServers,
      },
    };

    files.set(configPath, `${JSON.stringify(merged, null, 2)}\n`);
  }

  // Generate .mcp.json.example with all collected MCP servers
  const example = { mcpServers: allServers };
  files.set(".mcp.json.example", `${JSON.stringify(example, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// Step 5: Markdown template expansion
// ---------------------------------------------------------------------------

function expandMarkdownTemplates(presets: readonly Preset[], files: Map<string, string>): void {
  // Group markdown sections by file path
  const sectionsByPath = new Map<string, MarkdownSection[]>();

  for (const preset of presets) {
    if (!preset.markdown) continue;
    for (const [path, sections] of Object.entries(preset.markdown)) {
      const existing = sectionsByPath.get(path) ?? [];
      existing.push(...sections);
      sectionsByPath.set(path, existing);
    }
  }

  // Apply sections to each markdown file
  for (const [path, sections] of sectionsByPath) {
    const template = files.get(path) ?? "";
    files.set(path, mergeMarkdown(template, sections));
  }
}

// ---------------------------------------------------------------------------
// Step 6: Strip merge markers
// ---------------------------------------------------------------------------

const MERGE_MARKER_RE = /^[ \t]*\/\/ \[merge: [^\]]+\]\n?/gm;

function stripMergeMarkers(files: Map<string, string>): void {
  for (const [path, content] of files) {
    if (path.endsWith(".ts") && MERGE_MARKER_RE.test(content)) {
      MERGE_MARKER_RE.lastIndex = 0;
      files.set(path, content.replace(MERGE_MARKER_RE, ""));
    }
  }
}
