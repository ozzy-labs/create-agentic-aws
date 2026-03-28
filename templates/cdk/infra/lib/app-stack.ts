import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";
// [merge: imports]

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // [merge: constructs]
  }
}
