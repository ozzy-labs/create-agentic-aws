import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

export function createCdkPreset(): Preset {
  const templates = readTemplates("cdk");

  return {
    name: "cdk",

    requires: ["typescript"],

    files: {
      ...templates,
    },

    merge: {
      ".gitignore": "# CDK\ninfra/cdk.out/",
      ".mise.toml": {
        tools: {
          "npm:aws-cdk": "latest",
          "pipx:cfn-lint": "latest",
        },
      },
      "lefthook.yaml": {
        "pre-push": {
          commands: {
            "cdk-synth": {
              run: "cd infra && npx cdk synth --quiet",
            },
          },
        },
      },
      ".github/workflows/ci.yaml": {
        jobs: {
          ci: {
            steps: [
              {
                name: "CDK install",
                run: "cd infra && npm install",
              },
              {
                name: "CDK synth",
                run: "cd infra && npx cdk synth --quiet",
              },
              {
                name: "Lint (cfn-lint)",
                run: "cfn-lint infra/cdk.out/**/*.template.json",
              },
            ],
          },
        },
      },
      ".vscode/extensions.json": {
        recommendations: ["amazonwebservices.aws-toolkit-vscode"],
      },
      ".devcontainer/devcontainer.json": {
        customizations: {
          vscode: {
            extensions: ["amazonwebservices.aws-toolkit-vscode"],
          },
        },
      },
    },

    ciSteps: {
      buildSteps: [
        { name: "CDK install", run: "cd infra && npm install" },
        { name: "CDK synth", run: "cd infra && npx cdk synth --quiet" },
      ],
      lintSteps: [{ name: "Lint (cfn-lint)", run: "cfn-lint infra/cdk.out/**/*.template.json" }],
    },

    setupExtra: "cd infra && npm install",

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content:
            "- **AWS CDK**: Infrastructure as Code (TypeScript)\n- **cdk-nag**: Security and best-practice checks\n- **cfn-lint**: CloudFormation linting",
        },
      ],
    },
  };
}
