import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

const EVENTBRIDGE_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import type * as lambda from "aws-cdk-lib/aws-lambda";
import type { Construct } from "constructs";

export class EventBus extends Construct {
  public readonly bus: events.EventBus;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.bus = new events.EventBus(this, "Bus", {
      eventBusName: \`\${cdk.Stack.of(this).stackName}-bus\`,
    });

    // Archive all events for replay (30-day retention)
    this.bus.archive("Archive", {
      archiveName: \`\${cdk.Stack.of(this).stackName}-archive\`,
      retention: cdk.Duration.days(30),
    });

    new cdk.CfnOutput(this, "EventBusName", {
      value: this.bus.eventBusName,
      description: "EventBridge event bus name",
    });

    new cdk.CfnOutput(this, "EventBusArn", {
      value: this.bus.eventBusArn,
      description: "EventBridge event bus ARN",
    });
  }

  /** Grant a Lambda function permission to publish events and set EVENT_BUS_NAME env var. */
  grantLambdaPublish(handler: lambda.Function): void {
    this.bus.grantPutEventsTo(handler);
    handler.addEnvironment("EVENT_BUS_NAME", this.bus.eventBusName);
  }
}
`;

const EVENTBRIDGE_TF = `resource "aws_cloudwatch_event_bus" "this" {
  name = "\${var.project_name}-\${var.environment}-bus"
}

resource "aws_cloudwatch_event_archive" "this" {
  name             = "\${var.project_name}-\${var.environment}-archive"
  event_source_arn = aws_cloudwatch_event_bus.this.arn
  retention_days   = 30
}
`;

const EVENTBRIDGE_TF_OUTPUTS = `output "eventbridge_bus_name" {
  description = "EventBridge event bus name"
  value       = aws_cloudwatch_event_bus.this.name
}

output "eventbridge_bus_arn" {
  description = "EventBridge event bus ARN"
  value       = aws_cloudwatch_event_bus.this.arn
}
`;

export function createEventBridgePreset(): Preset {
  const templates = readTemplates("eventbridge");

  return {
    name: "eventbridge",

    files: {
      ...templates,
    },

    merge: {
      "tsconfig.json": {
        include: ["lib"],
      },
      "package.json": {
        dependencies: {
          "@aws-sdk/client-eventbridge": "^3.700.0",
        },
      },
    },

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/eventbridge.ts": EVENTBRIDGE_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { EventBus } from "./constructs/eventbridge";',
            constructs: '    new EventBus(this, "EventBus");',
          },
        },
      },
      terraform: {
        files: {
          "infra/eventbridge.tf": EVENTBRIDGE_TF,
        },
        merge: {
          "infra/outputs.tf": EVENTBRIDGE_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon EventBridge**: Event bus with archive",
        },
      ],
    },
  };
}
