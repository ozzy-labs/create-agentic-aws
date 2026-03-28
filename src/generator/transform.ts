import {
  OPENSEARCH_MANAGED_CONSTRUCT,
  OPENSEARCH_MANAGED_TF,
  OPENSEARCH_MANAGED_TF_OUTPUTS,
} from "../presets/opensearch.js";
import {
  REDSHIFT_PROVISIONED_CONSTRUCT,
  REDSHIFT_PROVISIONED_TF,
  REDSHIFT_PROVISIONED_TF_OUTPUTS,
} from "../presets/redshift.js";
import { readTemplates } from "../presets/templates.js";
import type { IacPresetName, Preset, WizardAnswers } from "../types.js";
import { requireFile, safeReplace, substituteVars } from "./helpers.js";

// ---------------------------------------------------------------------------
// Lambda VPC placement
// ---------------------------------------------------------------------------

export function applyLambdaVpcPlacement(iac: IacPresetName, files: Map<string, string>): void {
  const ctx = "applyLambdaVpcPlacement";
  if (iac === "cdk") {
    const appStack = requireFile(files, "infra/lib/app-stack.ts", ctx);
    files.set(
      "infra/lib/app-stack.ts",
      safeReplace(
        appStack,
        'new LambdaFunction(this, "LambdaFunction")',
        'new LambdaFunction(this, "LambdaFunction", { vpc: vpc.vpc })',
        ctx,
      ),
    );
  } else {
    const lambdaTf = requireFile(files, "infra/lambda.tf", ctx);
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
    let patched = safeReplace(
      lambdaTf,
      "  environment {",
      `  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {`,
      ctx,
    );
    patched = safeReplace(
      patched,
      'resource "aws_iam_role_policy_attachment" "lambda_basic" {',
      `resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {`,
      ctx,
    );
    files.set("infra/lambda.tf", patched + vpcConfig);
  }
}

// ---------------------------------------------------------------------------
// RDS engine option (PostgreSQL → MySQL)
// ---------------------------------------------------------------------------

export function applyRdsEngineOption(iac: IacPresetName, files: Map<string, string>): void {
  const ctx = "applyRdsEngineOption";
  if (iac === "cdk") {
    const construct = requireFile(files, "infra/lib/constructs/rds.ts", ctx);
    files.set(
      "infra/lib/constructs/rds.ts",
      safeReplace(
        construct,
        "engine: rds.DatabaseInstanceEngine.postgres({\n        version: rds.PostgresEngineVersion.VER_16_4,\n      })",
        "engine: rds.DatabaseInstanceEngine.mysql({\n        version: rds.MysqlEngineVersion.VER_8_0_40,\n      })",
        ctx,
      ),
    );
  } else {
    let tf = requireFile(files, "infra/rds.tf", ctx);
    tf = safeReplace(tf, 'engine         = "postgres"', 'engine         = "mysql"', ctx);
    tf = safeReplace(tf, 'engine_version = "16.4"', 'engine_version = "8.0.40"', ctx);
    tf = safeReplace(tf, "from_port   = 5432", "from_port   = 3306", ctx);
    tf = safeReplace(tf, "to_port     = 5432", "to_port     = 3306", ctx);
    files.set("infra/rds.tf", tf);
  }
}

// ---------------------------------------------------------------------------
// OpenSearch managed-cluster mode
// ---------------------------------------------------------------------------

export function applyOpenSearchManagedMode(iac: IacPresetName, files: Map<string, string>): void {
  const ctx = "applyOpenSearchManagedMode";
  if (iac === "cdk") {
    files.set("infra/lib/constructs/opensearch.ts", OPENSEARCH_MANAGED_CONSTRUCT);
    const appStack = requireFile(files, "infra/lib/app-stack.ts", ctx);
    let patched = safeReplace(
      appStack,
      'import { OpenSearchCollection } from "./constructs/opensearch";',
      'import { OpenSearchDomain } from "./constructs/opensearch";',
      ctx,
    );
    patched = safeReplace(
      patched,
      '    new OpenSearchCollection(this, "OpenSearchCollection");',
      '    new OpenSearchDomain(this, "OpenSearchDomain", { vpc: vpc.vpc });',
      ctx,
    );
    files.set("infra/lib/app-stack.ts", patched);
  } else {
    files.set("infra/opensearch.tf", OPENSEARCH_MANAGED_TF);
    const outputs = requireFile(files, "infra/outputs.tf", ctx);
    files.set(
      "infra/outputs.tf",
      safeReplace(
        outputs,
        /output "opensearch_collection_endpoint"[\s\S]*?}\n\noutput "opensearch_collection_arn"[\s\S]*?}\n/,
        OPENSEARCH_MANAGED_TF_OUTPUTS,
        ctx,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Bedrock KB + OpenSearch ARN wiring
// ---------------------------------------------------------------------------

export function applyBedrockKbOpenSearchWiring(
  answers: WizardAnswers,
  files: Map<string, string>,
): void {
  const ctx = "applyBedrockKbOpenSearchWiring";
  const isServerless = answers.openSearchOptions?.mode !== "managed-cluster";

  if (answers.iac === "cdk") {
    const appStack = requireFile(files, "infra/lib/app-stack.ts", ctx);
    const arnRef = isServerless
      ? "opensearchCollection.collection.attrArn"
      : "opensearchDomain.domain.domainArn";
    const varName = isServerless ? "opensearchCollection" : "opensearchDomain";
    const constructClass = isServerless ? "OpenSearchCollection" : "OpenSearchDomain";
    let patched = safeReplace(
      appStack,
      `    new ${constructClass}(this,`,
      `    const ${varName} = new ${constructClass}(this,`,
      ctx,
    );
    patched = safeReplace(
      patched,
      '{ collectionArn: "TODO: Set your OpenSearch Serverless collection ARN" }',
      `{ collectionArn: ${arnRef} }`,
      ctx,
    );

    const lines = patched.split("\n");
    const osIdx = lines.findIndex((l) => l.includes(`const ${varName} = new ${constructClass}(`));
    const kbIdx = lines.findIndex((l) => l.includes("new BedrockKnowledgeBase("));
    if (osIdx !== -1 && kbIdx !== -1 && osIdx > kbIdx) {
      const [osLine] = lines.splice(osIdx, 1);
      lines.splice(kbIdx, 0, osLine);
      patched = lines.join("\n");
    }

    files.set("infra/lib/app-stack.ts", patched);
  } else {
    const kbTf = requireFile(files, "infra/bedrock-kb.tf", ctx);
    if (isServerless) {
      files.set(
        "infra/bedrock-kb.tf",
        safeReplace(
          kbTf,
          'collection_arn    = "TODO: Set your OpenSearch Serverless collection ARN"',
          "collection_arn    = aws_opensearchserverless_collection.this.arn",
          ctx,
        ),
      );
    } else {
      let patched = safeReplace(
        kbTf,
        'type = "OPENSEARCH_SERVERLESS"',
        'type = "OPENSEARCH_MANAGED_CLUSTER"',
        ctx,
      );
      patched = safeReplace(
        patched,
        "opensearch_serverless_configuration",
        "opensearch_managed_cluster_configuration",
        ctx,
      );
      patched = safeReplace(
        patched,
        'collection_arn    = "TODO: Set your OpenSearch Serverless collection ARN"',
        "domain_arn        = aws_opensearch_domain.this.arn",
        ctx,
      );
      files.set("infra/bedrock-kb.tf", patched);
    }
  }
}

// ---------------------------------------------------------------------------
// Redshift provisioned mode
// ---------------------------------------------------------------------------

export function applyRedshiftProvisionedMode(iac: IacPresetName, files: Map<string, string>): void {
  const ctx = "applyRedshiftProvisionedMode";
  if (iac === "cdk") {
    files.set("infra/lib/constructs/redshift.ts", REDSHIFT_PROVISIONED_CONSTRUCT);
    const appStack = requireFile(files, "infra/lib/app-stack.ts", ctx);
    let patched = safeReplace(
      appStack,
      'import { RedshiftServerless } from "./constructs/redshift";',
      'import { RedshiftCluster } from "./constructs/redshift";',
      ctx,
    );
    patched = safeReplace(
      patched,
      '    new RedshiftServerless(this, "RedshiftServerless", { vpc: vpc.vpc });',
      '    new RedshiftCluster(this, "RedshiftCluster", { vpc: vpc.vpc });',
      ctx,
    );
    files.set("infra/lib/app-stack.ts", patched);
  } else {
    files.set("infra/redshift.tf", REDSHIFT_PROVISIONED_TF);
    const outputs = requireFile(files, "infra/outputs.tf", ctx);
    files.set(
      "infra/outputs.tf",
      safeReplace(
        outputs,
        /output "redshift_workgroup_endpoint"[\s\S]*?}\n\noutput "redshift_namespace_name"[\s\S]*?}\n/,
        REDSHIFT_PROVISIONED_TF_OUTPUTS,
        ctx,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// DynamoDB → Lambda integration (Terraform)
// ---------------------------------------------------------------------------

export function applyDynamoDbLambdaIntegration(
  iac: IacPresetName,
  files: Map<string, string>,
): void {
  const ctx = "applyDynamoDbLambdaIntegration";
  if (iac === "cdk") return;

  const lambdaTf = requireFile(files, "infra/lambda.tf", ctx);

  const patched = safeReplace(
    lambdaTf,
    '      NODE_OPTIONS = "--enable-source-maps"',
    `      NODE_OPTIONS = "--enable-source-maps"
      TABLE_NAME   = aws_dynamodb_table.this.name`,
    ctx,
  );

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
// Lambda Python runtime
// ---------------------------------------------------------------------------

const LAMBDA_PYTHON_TF_RUNTIME = `  handler          = "handler.handler"
  runtime          = "python3.12"`;

const LAMBDA_PYTHON_TF_ENV = `  environment {
    variables = {
      POWERTOOLS_SERVICE_NAME = var.project_name
    }
  }`;

export function applyLambdaPythonRuntime(
  files: Map<string, string>,
  vars: Record<string, string>,
): void {
  files.delete("lambda/handlers/index.ts");
  files.delete("lambda/powertools.ts");
  files.delete("lib/observability/middleware.ts");
  files.delete("lib/observability/index.ts");

  const pythonTemplates = readTemplates("lambda-python");
  for (const [path, content] of Object.entries(pythonTemplates)) {
    files.set(path, substituteVars(content, vars));
  }

  const tf = files.get("infra/lambda.tf");
  if (tf) {
    const ctx = "applyLambdaPythonRuntime";
    let patched = safeReplace(
      tf,
      '  handler          = "index.handler"\n  runtime          = "nodejs24.x"',
      LAMBDA_PYTHON_TF_RUNTIME,
      ctx,
    );
    patched = safeReplace(
      patched,
      `  environment {\n    variables = {\n      NODE_OPTIONS = "--enable-source-maps"\n    }\n  }`,
      LAMBDA_PYTHON_TF_ENV,
      ctx,
    );
    patched = safeReplace(
      patched,
      /resource "null_resource" "lambda_build" \{[\s\S]*?\n\}\n\n/,
      "",
      ctx,
    );
    patched = safeReplace(
      patched,
      /data "archive_file" "lambda" \{[\s\S]*?\n\}/,
      `data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "\${path.module}/../lambda/handlers"
  output_path = "\${path.module}/.build/lambda.zip"
}`,
      ctx,
    );
    files.set("infra/lambda.tf", patched);
  }
}

// ---------------------------------------------------------------------------
// Lambda Python dependency swap
// ---------------------------------------------------------------------------

const LAMBDA_NPM_DEPS = [
  "@aws-lambda-powertools/logger",
  "@aws-lambda-powertools/metrics",
  "@aws-lambda-powertools/tracer",
  "@middy/core",
];
const LAMBDA_NPM_DEV_DEPS = ["@types/aws-lambda"];

export function applyLambdaPythonDeps(files: Map<string, string>): void {
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

  files.delete("tsconfig.json");

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
// Ensure tsconfig.json base template
// ---------------------------------------------------------------------------

export function ensureTsconfigBase(presets: readonly Preset[], files: Map<string, string>): void {
  if (files.has("tsconfig.json")) return;

  const hasTsconfigMerge = presets.some((p) => "tsconfig.json" in p.merge);
  if (!hasTsconfigMerge) return;

  const tsconfigTemplate = readTemplates("typescript")["tsconfig.json"];
  if (tsconfigTemplate) {
    files.set("tsconfig.json", tsconfigTemplate);
  }
}

// ---------------------------------------------------------------------------
// README label swaps
// ---------------------------------------------------------------------------

export function applyReadmeLabels(
  answers: WizardAnswers,
  presetNames: ReadonlySet<string>,
  files: Map<string, string>,
): void {
  if (answers.rdsOptions?.engine === "mysql") {
    const readme = requireFile(files, "README.md", "readmeRdsLabel");
    files.set(
      "README.md",
      safeReplace(
        readme,
        "PostgreSQL relational database",
        "MySQL relational database",
        "readmeRdsLabel",
      ),
    );
  }

  if (presetNames.has("lambda") && presetNames.has("python") && !presetNames.has("typescript")) {
    let readme = requireFile(files, "README.md", "readmeLambdaPythonLabel");
    readme = safeReplace(
      readme,
      "Serverless compute (Node.js 24)",
      "Serverless compute (Python 3.12)",
      "readmeLambdaPythonLabel",
    );
    readme = safeReplace(
      readme,
      "Structured logging, metrics, tracing",
      "Structured logging, metrics, tracing (Python)",
      "readmeLambdaPythonLabel",
    );
    files.set("README.md", readme);
  }

  if (answers.openSearchOptions?.mode === "managed-cluster") {
    const readme = requireFile(files, "README.md", "readmeOpenSearchLabel");
    files.set(
      "README.md",
      safeReplace(
        readme,
        "**Amazon OpenSearch Serverless**: Serverless search and analytics collection",
        "**Amazon OpenSearch Service**: Managed search and analytics cluster (VPC)",
        "readmeOpenSearchLabel",
      ),
    );
  }

  if (answers.redshiftOptions?.mode === "provisioned") {
    const readme = requireFile(files, "README.md", "readmeRedshiftLabel");
    files.set(
      "README.md",
      safeReplace(
        readme,
        "Serverless data warehouse (namespace + workgroup)",
        "Provisioned data warehouse cluster",
        "readmeRedshiftLabel",
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Cognito + API Gateway (Terraform): add authorization to default route
// ---------------------------------------------------------------------------

export function applyCognitoApiGatewayAuth(files: Map<string, string>): void {
  const ctx = "applyCognitoApiGatewayAuth";
  const apigwTf = requireFile(files, "infra/api-gateway.tf", ctx);
  const lambdaRef = "$" + "{aws_apigatewayv2_integration.lambda.id}";
  const search = `  route_key = "$default"\n  target    = "integrations/${lambdaRef}"`;
  const replacement = `  route_key          = "$default"\n  target             = "integrations/${lambdaRef}"\n  authorization_type = "JWT"\n  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id`;
  files.set("infra/api-gateway.tf", safeReplace(apigwTf, search, replacement, ctx));
}
