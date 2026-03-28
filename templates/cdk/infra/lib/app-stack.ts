import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Service constructs will be instantiated here by service presets.
  }
}
