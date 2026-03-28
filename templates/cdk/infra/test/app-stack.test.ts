import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { AppStack } from "../lib/app-stack";

describe("AppStack", () => {
  it("synthesizes without errors", () => {
    const app = new cdk.App();
    const stack = new AppStack(app, "TestStack");
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toBeDefined();
  });
});
