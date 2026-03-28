import type { Preset } from "../types.js";

const API_GATEWAY_TF = `resource "aws_apigatewayv2_api" "this" {
  name          = "\${var.project_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true
}
`;

const API_GATEWAY_TF_OUTPUTS = `output "api_gateway_url" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_stage.default.invoke_url
}
`;

const API_GATEWAY_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import type * as cognito from "aws-cdk-lib/aws-cognito";
import type * as lambda from "aws-cdk-lib/aws-lambda";
import type { Construct } from "constructs";

export interface ApiGatewayProps {
  /** API type: "rest" for REST API, "http" for HTTP API. */
  readonly type: "rest" | "http";
  /** Lambda function to integrate as the default backend. */
  readonly handler: lambda.IFunction;
}

export class ApiGateway extends Construct {
  public readonly restApi?: apigateway.RestApi;
  public readonly httpApi?: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiGatewayProps) {
    super(scope, id);

    if (props.type === "rest") {
      this.restApi = new apigateway.RestApi(this, "RestApi", {
        restApiName: id,
        deployOptions: {
          stageName: "prod",
          tracingEnabled: true,
        },
        defaultCorsPreflightOptions: {
          allowOrigins: apigateway.Cors.ALL_ORIGINS,
          allowMethods: apigateway.Cors.ALL_METHODS,
        },
      });

      this.restApi.root.addProxy({
        defaultIntegration: new apigateway.LambdaIntegration(props.handler),
        anyMethod: true,
      });

      new cdk.CfnOutput(this, "RestApiUrl", {
        value: this.restApi.url,
        description: "REST API URL",
      });
    } else {
      this.httpApi = new apigatewayv2.HttpApi(this, "HttpApi", {
        apiName: id,
        corsPreflight: {
          allowOrigins: ["*"],
          allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
          allowHeaders: ["Content-Type", "Authorization"],
        },
      });

      new cdk.CfnOutput(this, "HttpApiUrl", {
        value: this.httpApi.apiEndpoint,
        description: "HTTP API URL",
      });
    }
  }

  /** Attach a Cognito authorizer to the REST API. */
  addAuthorizer(userPool: cognito.IUserPool): void {
    if (!this.restApi) return;

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "CognitoAuthorizer",
      { cognitoUserPools: [userPool] },
    );

    this.restApi.methods
      .filter((m) => m.httpMethod !== "OPTIONS")
      .forEach((method) => {
        const cfnMethod = method.node.defaultChild as apigateway.CfnMethod;
        cfnMethod.authorizationType = "COGNITO_USER_POOLS";
        cfnMethod.authorizerId = authorizer.authorizerId;
      });
  }
}
`;

export function createApiGatewayPreset(): Preset {
  return {
    name: "api-gateway",

    requires: ["lambda"],

    files: {},

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/api-gateway.ts": API_GATEWAY_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { ApiGateway } from "./constructs/api-gateway";',
            constructs:
              '    const apiGateway = new ApiGateway(this, "ApiGateway", {\n      type: "rest",\n      handler: lambdaFunction.handler,\n    });',
          },
        },
      },
      terraform: {
        files: {
          "infra/api-gateway.tf": API_GATEWAY_TF,
        },
        merge: {
          "infra/outputs.tf": API_GATEWAY_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon API Gateway**: REST / HTTP API",
        },
      ],
    },
  };
}
