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

The interactive wizard asks 12 questions in an agent-first flow:

1. **Project name**
2. **AI Agent tools** — Amazon Q / Claude Code / GitHub Copilot (multi-select)
3. **Infrastructure as Code** — CDK / Terraform
4. **Compute** — Lambda / ECS / EKS / EC2 (multi-select)
5. **AI** — Bedrock / Bedrock Knowledge Bases / Bedrock Agents / OpenSearch (multi-select)
6. **Data & Storage** — S3 / DynamoDB / Aurora / RDS (multi-select)
7. **Data Pipeline & Analytics** — Kinesis / Glue / Redshift (multi-select)
8. **Application Integration** — SQS / SNS / EventBridge / Step Functions (multi-select)
9. **Networking & API** — API Gateway / CloudFront (multi-select)
10. **Security & Identity** — Cognito (multi-select)
11. **Observability** — CloudWatch (multi-select)
12. **Language toolchains** — TypeScript / Python (excluding auto-resolved)

Sub-options (ECS launch type, Aurora engine, API Gateway type, etc.) are shown after parent selection.

## Presets

Composable presets across 13 layers. Each provides owned files + IaC contributions + merge contributions to shared files.

| Layer | Presets |
|-------|--------|
| Base | Always included (AWS CLI, git hooks, linters, devcontainer) |
| Agent | Amazon Q, Claude Code, GitHub Copilot |
| IaC | CDK (TypeScript), Terraform |
| Compute | Lambda, ECS, EKS, EC2 |
| AI | Bedrock, Bedrock Knowledge Bases, Bedrock Agents, OpenSearch |
| Data & Storage | S3, DynamoDB, Aurora, RDS |
| Data Pipeline & Analytics | Kinesis, Glue, Redshift |
| Application Integration | SQS, SNS, EventBridge, Step Functions |
| Networking & API | API Gateway, CloudFront |
| Security & Identity | Cognito |
| Observability | CloudWatch |
| Language | TypeScript, Python |
| Infrastructure (auto) | VPC (auto-resolved by compute/DB selection) |

### Service x IaC matrix

Each AWS service preset provides IaC-specific contributions. CDK generates Constructs; Terraform generates .tf files. Total: 24 services x 2 IaC = 48 templates.

See [docs/resource-map.md](docs/resource-map.md) for a complete mapping of wizard selections to generated AWS resources (CDK constructs and Terraform resource types).

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

Development is tracked via [GitHub Milestones](https://github.com/ozzy-labs/create-agentic-aws/milestones).

## Architecture

- `src/presets/*.ts` — Preset logic (merge contributions, IaC contributions, dependencies)
- `templates/*/` — Preset file assets (copied as-is to output)
- `src/generator/` — Composition engine (resolve → transform → finalize → output)
- `src/merge.ts` — Per-filetype merge logic (JSON, YAML, TOML, HCL, Markdown)

See [docs/design.md](docs/design.md) for the full design document.

## License

MIT
