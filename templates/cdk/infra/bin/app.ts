#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { Aspects } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { AppStack } from "../lib/app-stack";

const app = new cdk.App();

new AppStack(app, "AppStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

// cdk-nag: AWS Solutions checks
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

app.synth();
