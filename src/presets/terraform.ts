import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

export function createTerraformPreset(): Preset {
  const templates = readTemplates("terraform");

  return {
    name: "terraform",

    files: {
      ...templates,
    },

    merge: {
      ".gitignore":
        "# Terraform\ninfra/.terraform/\ninfra/*.tfstate\ninfra/*.tfstate.backup\ninfra/.terraform.lock.hcl",
      ".mise.toml": {
        tools: {
          terraform: "1",
          tflint: "0",
        },
      },
      "lefthook.yaml": {
        "pre-commit": {
          commands: {
            "terraform-fmt": {
              glob: "*.tf",
              run: "terraform -chdir=infra fmt -check",
            },
            tflint: {
              glob: "*.tf",
              run: "cd infra && tflint",
            },
          },
        },
        "pre-push": {
          commands: {
            "terraform-validate": {
              run: "cd infra && terraform init -backend=false -input=false && terraform validate",
            },
          },
        },
      },
      ".github/workflows/ci.yaml": {
        jobs: {
          ci: {
            steps: [
              {
                name: "Terraform init",
                run: "cd infra && terraform init -backend=false -input=false",
              },
              {
                name: "Terraform validate",
                run: "cd infra && terraform validate",
              },
              {
                name: "Terraform fmt check",
                run: "terraform -chdir=infra fmt -check",
              },
              {
                name: "Lint (tflint)",
                run: "cd infra && tflint",
              },
            ],
          },
        },
      },
      ".vscode/extensions.json": {
        recommendations: ["hashicorp.terraform"],
      },
      ".devcontainer/devcontainer.json": {
        customizations: {
          vscode: {
            extensions: ["hashicorp.terraform"],
          },
        },
      },
    },

    ciSteps: {
      buildSteps: [
        { name: "Terraform init", run: "cd infra && terraform init -backend=false -input=false" },
        { name: "Terraform validate", run: "cd infra && terraform validate" },
      ],
      lintSteps: [
        { name: "Terraform fmt check", run: "terraform -chdir=infra fmt -check" },
        { name: "Lint (tflint)", run: "cd infra && tflint" },
      ],
    },

    setupExtra: "cd infra && terraform init -backend=false",

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content:
            "- **Terraform**: Infrastructure as Code\n- **tflint**: Terraform linting (AWS plugin)",
        },
        {
          heading: "## Project Structure",
          content: "- **`infra/`** — Terraform configurations",
        },
        {
          heading: "## Development",
          content:
            "```bash\ncd infra\nterraform fmt       # Format Terraform files\nterraform validate  # Validate configuration\nterraform plan      # Preview changes\nterraform apply     # Apply changes\n```",
        },
      ],
      "docs/cd-setup.md": [
        {
          heading: "# CD Setup Guide",
          content:
            "## Terraform\n\n```bash\ncd infra\nterraform init\nterraform plan\nterraform apply\n```",
        },
      ],
    },
  };
}
