import type { Preset } from "../types.js";

const COGNITO_TF = `resource "aws_cognito_user_pool" "this" {
  name = "\${var.project_name}-\${var.environment}-user-pool"

  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_client" "this" {
  name         = "\${var.project_name}-app-client"
  user_pool_id = aws_cognito_user_pool.this.id

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  prevent_user_existence_errors = "ENABLED"
}
`;

const COGNITO_TF_OUTPUTS = `output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.this.id
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.this.id
}
`;

const COGNITO_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import type { Construct } from "constructs";

export class CognitoAuth extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.userPoolClient = this.userPool.addClient("AppClient", {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      preventUserExistenceErrors: true,
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
      description: "Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    });
  }
}
`;

const COGNITO_TF_APIGW_AUTHORIZER = `
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.this.id
  authorizer_type  = "JWT"
  name             = "CognitoJwtAuthorizer"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.this.id]
    issuer   = "https://cognito-idp.\${var.aws_region}.amazonaws.com/\${aws_cognito_user_pool.this.id}"
  }
}
`;

export function createCognitoPreset(): Preset {
  return {
    name: "cognito",

    requires: ["api-gateway"],

    files: {},

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/cognito.ts": COGNITO_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { CognitoAuth } from "./constructs/cognito";',
            constructs:
              '    const cognitoAuth = new CognitoAuth(this, "CognitoAuth");\n    apiGateway.addAuthorizer(cognitoAuth.userPool, cognitoAuth.userPoolClient);',
          },
        },
      },
      terraform: {
        files: {
          "infra/cognito.tf": COGNITO_TF,
        },
        merge: {
          "infra/outputs.tf": COGNITO_TF_OUTPUTS,
          "infra/api-gateway.tf": COGNITO_TF_APIGW_AUTHORIZER,
        },
      },
    },

    awsResources: [
      { service: "Cognito", type: "User Pool" },
      { service: "Cognito", type: "User Pool Client" },
    ],

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon Cognito**: User authentication and authorization",
        },
        {
          heading: "## Setup Checklist",
          content: "- [ ] **Cognito**: Configure allowed sign-up domains and MFA settings",
        },
      ],
    },
  };
}
