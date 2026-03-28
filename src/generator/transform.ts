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
import { substituteVars } from "./helpers.js";

// ---------------------------------------------------------------------------
// Lambda VPC placement
// ---------------------------------------------------------------------------

export function applyLambdaVpcPlacement(iac: IacPresetName, files: Map<string, string>): void {
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
// RDS engine option (PostgreSQL → MySQL)
// ---------------------------------------------------------------------------

export function applyRdsEngineOption(iac: IacPresetName, files: Map<string, string>): void {
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
// OpenSearch managed-cluster mode (Serverless → Managed Cluster)
// ---------------------------------------------------------------------------

export function applyOpenSearchManagedMode(iac: IacPresetName, files: Map<string, string>): void {
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
// Bedrock KB + OpenSearch ARN wiring
// ---------------------------------------------------------------------------

export function applyBedrockKbOpenSearchWiring(
  answers: WizardAnswers,
  files: Map<string, string>,
): void {
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
// Redshift provisioned mode (Serverless → Provisioned)
// ---------------------------------------------------------------------------

export function applyRedshiftProvisionedMode(iac: IacPresetName, files: Map<string, string>): void {
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
// DynamoDB → Lambda integration (Terraform)
// ---------------------------------------------------------------------------

export function applyDynamoDbLambdaIntegration(
  iac: IacPresetName,
  files: Map<string, string>,
): void {
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
// Lambda Python runtime (TypeScript → Python)
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
// Lambda Python dependency swap
// ---------------------------------------------------------------------------

/** npm Lambda Powertools packages to remove from package.json for Python projects. */
const LAMBDA_NPM_DEPS = [
  "@aws-lambda-powertools/logger",
  "@aws-lambda-powertools/metrics",
  "@aws-lambda-powertools/tracer",
  "@middy/core",
];
const LAMBDA_NPM_DEV_DEPS = ["@types/aws-lambda"];

export function applyLambdaPythonDeps(files: Map<string, string>): void {
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
// Ensure tsconfig.json base template exists
// ---------------------------------------------------------------------------

export function ensureTsconfigBase(presets: readonly Preset[], files: Map<string, string>): void {
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
// README label swaps
// ---------------------------------------------------------------------------

export function applyReadmeLabels(
  answers: WizardAnswers,
  presetNames: ReadonlySet<string>,
  files: Map<string, string>,
): void {
  // RDS engine label
  if (answers.rdsOptions?.engine === "mysql") {
    const readme = files.get("README.md");
    if (readme) {
      files.set(
        "README.md",
        readme.replace("PostgreSQL relational database", "MySQL relational database"),
      );
    }
  }

  // Lambda Python label
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

  // OpenSearch managed-cluster label
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

  // Redshift provisioned label
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
}
