# CD Setup Guide

This project includes CI (lint, typecheck, test, build) but not CD.
Set up CD based on your deployment target and environment.

## AWS CDK

```bash
npx cdk deploy --profile <profile>
```

## Terraform

```bash
cd infra
terraform init
terraform plan
terraform apply
```

## GitHub Actions CD

Add a deployment workflow in `.github/workflows/cd.yaml` with appropriate
environment secrets and approval gates.
