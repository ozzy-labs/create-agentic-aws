import type { Preset } from "../types.js";

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

export function createCognitoPreset(): Preset {
  return {
    name: "cognito",

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
            constructs: '    new CognitoAuth(this, "CognitoAuth");',
          },
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon Cognito**: User authentication and authorization",
        },
      ],
    },
  };
}
