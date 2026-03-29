import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

// ---------------------------------------------------------------------------
// CDK Construct — Glue Database, Crawler, Job
// ---------------------------------------------------------------------------

const GLUE_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as glue from "aws-cdk-lib/aws-glue";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";

export class GlueEtl extends Construct {
  public readonly database: glue.CfnDatabase;
  public readonly job: glue.CfnJob;
  public readonly scriptBucket: s3.Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Glue Data Catalog database
    this.database = new glue.CfnDatabase(this, "Database", {
      catalogId: cdk.Aws.ACCOUNT_ID,
      databaseInput: {
        name: cdk.Names.uniqueId(this).toLowerCase().slice(0, 28) + "_db",
      },
    });

    // S3 bucket for Glue job scripts
    this.scriptBucket = new s3.Bucket(this, "ScriptBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // IAM role for Glue
    const role = new iam.Role(this, "Role", {
      assumedBy: new iam.ServicePrincipal("glue.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSGlueServiceRole"),
      ],
    });

    // Upload Glue job scripts to S3
    new s3deploy.BucketDeployment(this, "DeployScripts", {
      sources: [s3deploy.Source.asset("glue/jobs")],
      destinationBucket: this.scriptBucket,
      destinationKeyPrefix: "jobs",
    });

    this.scriptBucket.grantRead(role);

    // Glue ETL job
    this.job = new glue.CfnJob(this, "Job", {
      name: cdk.Names.uniqueId(this).slice(0, 32) + "-etl",
      role: role.roleArn,
      command: {
        name: "glueetl",
        pythonVersion: "3",
        scriptLocation: \`s3://\${this.scriptBucket.bucketName}/jobs/etl_job.py\`,
      },
      glueVersion: "4.0",
      workerType: "G.1X",
      numberOfWorkers: 2,
      defaultArguments: {
        "--job-language": "python",
        "--enable-metrics": "true",
        "--enable-continuous-cloudwatch-log": "true",
        "--DATABASE_NAME": this.database.ref,
        "--OUTPUT_BUCKET": this.scriptBucket.bucketName,
      },
    });

    new cdk.CfnOutput(this, "DatabaseName", {
      value: this.database.ref,
      description: "Glue Data Catalog database name",
    });

    new cdk.CfnOutput(this, "JobName", {
      value: this.job.ref,
      description: "Glue ETL job name",
    });

    new cdk.CfnOutput(this, "ScriptBucketName", {
      value: this.scriptBucket.bucketName,
      description: "S3 bucket for Glue job scripts",
    });
  }
}
`;

// ---------------------------------------------------------------------------
// Terraform — Glue Database, Crawler, Job
// ---------------------------------------------------------------------------

const GLUE_TF = `resource "aws_glue_catalog_database" "this" {
  name = "\${var.project_name}_\${var.environment}_db"
}

resource "aws_s3_bucket" "glue_scripts" {
  bucket_prefix = "\${var.project_name}-glue-scripts-"
  force_destroy = false
}

resource "aws_s3_bucket_public_access_block" "glue_scripts" {
  bucket                  = aws_s3_bucket.glue_scripts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "glue_scripts" {
  bucket = aws_s3_bucket.glue_scripts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_object" "etl_job_script" {
  bucket = aws_s3_bucket.glue_scripts.id
  key    = "jobs/etl_job.py"
  source = "glue/jobs/etl_job.py"
  etag   = filemd5("glue/jobs/etl_job.py")
}

data "aws_iam_policy_document" "glue_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["glue.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "glue" {
  name               = "\${var.project_name}-\${var.environment}-glue"
  assume_role_policy = data.aws_iam_policy_document.glue_trust.json
}

resource "aws_iam_role_policy_attachment" "glue_service" {
  role       = aws_iam_role.glue.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
}

resource "aws_iam_role_policy" "glue_s3" {
  name = "\${var.project_name}-\${var.environment}-glue-s3"
  role = aws_iam_role.glue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.glue_scripts.arn,
          "\${aws_s3_bucket.glue_scripts.arn}/*",
        ]
      },
    ]
  })
}

resource "aws_glue_job" "etl" {
  name     = "\${var.project_name}-\${var.environment}-etl"
  role_arn = aws_iam_role.glue.arn

  command {
    name            = "glueetl"
    python_version  = "3"
    script_location = "s3://\${aws_s3_bucket.glue_scripts.id}/jobs/etl_job.py"
  }

  glue_version      = "4.0"
  worker_type       = "G.1X"
  number_of_workers = 2

  default_arguments = {
    "--job-language"                          = "python"
    "--enable-metrics"                        = "true"
    "--enable-continuous-cloudwatch-log"       = "true"
    "--DATABASE_NAME"                         = aws_glue_catalog_database.this.name
    "--OUTPUT_BUCKET"                         = aws_s3_bucket.glue_scripts.id
  }
}
`;

const GLUE_TF_OUTPUTS = `output "glue_database_name" {
  description = "Glue Data Catalog database name"
  value       = aws_glue_catalog_database.this.name
}

output "glue_job_name" {
  description = "Glue ETL job name"
  value       = aws_glue_job.etl.name
}

output "glue_scripts_bucket" {
  description = "S3 bucket for Glue job scripts"
  value       = aws_s3_bucket.glue_scripts.id
}
`;

// ---------------------------------------------------------------------------
// Preset factory
// ---------------------------------------------------------------------------

export function createGluePreset(): Preset {
  const templates = readTemplates("glue");

  return {
    name: "glue",

    requires: ["python"],

    files: {
      ...templates,
    },

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/glue.ts": GLUE_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { GlueEtl } from "./constructs/glue";',
            constructs: '    new GlueEtl(this, "GlueEtl");',
          },
        },
      },
      terraform: {
        files: {
          "infra/glue.tf": GLUE_TF,
        },
        merge: {
          "infra/outputs.tf": GLUE_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content:
            "- **AWS Glue**: Serverless ETL with PySpark (Glue 4.0) — creates its own S3 bucket for scripts and output",
        },
        {
          heading: "## Setup Checklist",
          content: "- [ ] **Glue**: Customize ETL job script in `glue/jobs/`",
        },
      ],
    },
  };
}
