import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

const CLOUDWATCH_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import type { Construct } from "constructs";

export class CloudWatchDashboard extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.dashboard = new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: \`\${cdk.Stack.of(this).stackName}-dashboard\`,
      defaultInterval: cdk.Duration.hours(3),
    });

    // Add widgets for your services here.
    // Example:
    // this.dashboard.addWidgets(
    //   new cloudwatch.GraphWidget({
    //     title: "Lambda Invocations",
    //     left: [lambdaFunction.metricInvocations()],
    //   }),
    // );
  }
}
`;

export function createCloudWatchPreset(): Preset {
  const templates = readTemplates("cloudwatch");

  return {
    name: "cloudwatch",

    files: {
      ...templates,
    },

    merge: {
      "package.json": {
        devDependencies: {
          "@aws-lambda-powertools/logger": "^2.14.0",
          "@aws-lambda-powertools/metrics": "^2.14.0",
          "@aws-lambda-powertools/tracer": "^2.14.0",
          "@middy/core": "^6.0.0",
        },
      },
    },

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/cloudwatch.ts": CLOUDWATCH_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { CloudWatchDashboard } from "./constructs/cloudwatch";',
            constructs: '    new CloudWatchDashboard(this, "CloudWatchDashboard");',
          },
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content:
            "- **Amazon CloudWatch**: Monitoring dashboard\n- **Lambda Powertools**: Structured logging, metrics, tracing",
        },
      ],
    },
  };
}
