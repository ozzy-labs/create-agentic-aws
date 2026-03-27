# create-agentic-aws

[日本語](README.ja.md)

CLI tool to generate AI-agent-native AWS projects — supports Amazon Q, Claude Code, Copilot, and more

## Quick Start

```bash
pnpm create agentic-aws my-app
cd my-app
bash scripts/setup.sh
```

## Wizard

The interactive wizard asks 10 questions in an agent-first flow:

1. **Project name**
2. **AI Agent tools** — Amazon Q / Claude Code / GitHub Copilot (multi-select)
3. **Infrastructure as Code** — CDK / Terraform
4. **Compute** — Lambda / ECS / EKS / EC2 (multi-select)
5. **Data & Storage** — S3 / DynamoDB / Aurora / RDS (multi-select)
6. **Application Integration** — SQS / SNS / EventBridge / Step Functions (multi-select)
7. **Networking & API** — API Gateway / CloudFront (multi-select)
8. **Security & Identity** — Cognito (multi-select)
9. **Observability** — CloudWatch (multi-select)
10. **Language toolchains** — TypeScript / Python (excluding auto-resolved)

Sub-options (ECS launch type, Aurora engine, API Gateway type, etc.) are shown after parent selection.

## Presets

Composable presets across 10 layers. Each provides owned files + IaC contributions + merge contributions to shared files.

| Layer | Presets |
|-------|--------|
| Base | Always included (AWS CLI, git hooks, linters, devcontainer) |
| Agent | Amazon Q, Claude Code, GitHub Copilot |
| IaC | CDK (TypeScript), Terraform |
| Compute | Lambda, ECS, EKS, EC2 |
| Data & Storage | S3, DynamoDB, Aurora, RDS |
| Application Integration | SQS, SNS, EventBridge, Step Functions |
| Networking & API | API Gateway, CloudFront |
| Security & Identity | Cognito |
| Observability | CloudWatch |
| Language | TypeScript, Python |
| Infrastructure (auto) | VPC (auto-resolved by compute/DB selection) |

### Service x IaC matrix

Each AWS service preset provides IaC-specific contributions. CDK generates Constructs; Terraform generates .tf files. Total: 17 services x 2 IaC = 34 templates.

See [docs/design.md](docs/design.md) for the full preset details, dependency chains, and file ownership.

## What You Get

Every generated project includes:

- **AI Agent integration** — Instruction files, MCP servers, skills (Claude Code), and rules per agent
- **AWS infrastructure** — CDK Constructs or Terraform configs for selected services
- **Git hooks** — commitlint (commit-msg), linters + Gitleaks (pre-commit), typecheck (pre-push)
- **CI workflow** — All linters + tests + build on push/PR
- **Dev Container** — VSCode devcontainer with AWS CLI, preset-specific tools, extensions, and ~/.aws mount
- **Renovate** — Automated dependency updates

### Generated project structure

```text
my-project/
├── infra/          # IaC (CDK Constructs or Terraform .tf files)
├── lambda/         # Lambda handlers (if selected)
├── ecs/            # ECS Dockerfile + app (if selected)
├── eks/            # EKS Dockerfile + app + K8s manifests (if selected)
├── ec2/            # EC2 user data (if selected)
├── lib/            # Shared code (DAL, consumers, schemas)
├── tests/
├── scripts/
├── .devcontainer/
├── .github/
├── .vscode/
└── ...
```

## Development

```bash
pnpm install          # Install dependencies
pnpm run dev          # Watch mode build
pnpm run build        # Production build
pnpm test             # Run tests
pnpm run lint:all     # All linters + typecheck
pnpm run verify       # Verify generated output
```

### Roadmap

Development is tracked via [GitHub Milestones](https://github.com/ozzy-labs/create-agentic-aws/milestones) and [GitHub Projects](https://github.com/orgs/ozzy-labs/projects).

| Milestone | Theme |
|-----------|-------|
| M1 | Project foundation (GitHub management + dev environment + CI) |
| M2 | Core engine, base preset, wizard, agents, languages, i18n |
| M3 | CDK + serverless services (Lambda, API GW, S3, DynamoDB, SQS, CloudFront, Cognito, CloudWatch) |
| M4 | Terraform support for M3 services |
| M5 | Container/Server + RDB (ECS, EKS, EC2, VPC, Aurora, RDS) |
| M6 | Event-driven (SNS, EventBridge, Step Functions) |

## Architecture

- `src/presets/*.ts` — Preset logic (merge contributions, IaC contributions, dependencies)
- `templates/*/` — Preset file assets (copied as-is to output)
- `src/generator.ts` — Composition engine (resolve → merge → output)
- `src/merge.ts` — Per-filetype merge logic (JSON, YAML, TOML, HCL, Markdown)

See [docs/design.md](docs/design.md) for the full design document.

## License

MIT
