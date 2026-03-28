import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

export function createBasePreset(): Preset {
  const templates = readTemplates("base");

  return {
    name: "base",

    files: {
      // All template files (owned by base)
      ...templates,

      // Shared files — base provides the initial template.
      // Other presets contribute via `merge`.
      "package.json": PACKAGE_JSON,
      ".mise.toml": MISE_TOML,
      "lefthook.yaml": LEFTHOOK_YAML,
      ".devcontainer/devcontainer.json": DEVCONTAINER_JSON,
      ".github/workflows/ci.yaml": CI_YAML,
      ".vscode/settings.json": VSCODE_SETTINGS,
      ".vscode/extensions.json": VSCODE_EXTENSIONS,
    },

    merge: {},

    mcpServers: {
      "aws-documentation": {
        command: "uvx",
        args: ["awslabs.aws-documentation-mcp-server@latest"],
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **AWS CLI**: Included via mise",
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Shared file templates (inline — these are the base versions)
// ---------------------------------------------------------------------------

const PACKAGE_JSON = `{
  "name": "{{projectName}}",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "prepare": "lefthook install"
  },
  "engines": {
    "node": ">=24"
  },
  "devDependencies": {
    "@commitlint/cli": "^20.0.0",
    "@commitlint/config-conventional": "^20.0.0",
    "lefthook": "^2.1.0",
    "markdownlint-cli2": "^0.21.0"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["lefthook"]
  }
}
`;

const MISE_TOML = `[tools]
node = "24"
pnpm = "10"
"pipx:yamllint" = "latest"
yamlfmt = "latest"
shellcheck = "latest"
shfmt = "latest"
taplo = "latest"
actionlint = "latest"
gitleaks = "latest"
awscli = "latest"

[env]
_.path = ["./node_modules/.bin", "./scripts"]
`;

const LEFTHOOK_YAML = `commit-msg:
  commands:
    commitlint:
      run: commitlint --edit {1}

pre-commit:
  parallel: true
  commands:
    markdownlint:
      glob: "*.md"
      run: markdownlint-cli2 {staged_files}
    yamlfmt:
      glob: "*.{yaml,yml}"
      run: yamlfmt {staged_files}
    yamllint:
      glob: "*.{yaml,yml}"
      run: yamllint -c .yamllint.yaml {staged_files}
    shellcheck:
      glob: "*.sh"
      run: shellcheck {staged_files}
    shfmt:
      glob: "*.sh"
      run: shfmt -d {staged_files}
    taplo:
      glob: "*.toml"
      run: taplo format --check {staged_files}
    actionlint:
      glob: ".github/workflows/*.{yaml,yml}"
      run: actionlint
    gitleaks:
      run: gitleaks detect --no-banner
`;

const DEVCONTAINER_JSON = `{
  "name": "{{projectName}}",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/jdx/devcontainer-features/mise:1": {},
    "ghcr.io/devcontainers/features/node:1": { "version": "22" },
    "ghcr.io/devcontainers-extra/features/pnpm:1": {},
    "ghcr.io/devcontainers/features/aws-cli:1": {},
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },
  "mounts": [
    "source=\${localEnv:HOME}/.aws,target=/home/vscode/.aws,type=bind,readonly"
  ],
  "postCreateCommand": "mise install && pnpm install",
  "customizations": {
    "vscode": {
      "extensions": [
        "EditorConfig.EditorConfig",
        "DavidAnson.vscode-markdownlint",
        "redhat.vscode-yaml",
        "tamasfe.even-better-toml"
      ]
    }
  }
}
`;

const CI_YAML = `name: ci

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: jdx/mise-action@v2

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint (markdown)
        run: markdownlint-cli2 '**/*.md' '#**/node_modules'

      - name: Lint (yaml)
        run: yamllint -c .yamllint.yaml .

      - name: Lint (shell)
        run: |
          if [ -d scripts ]; then
            shellcheck scripts/*.sh
            shfmt -d scripts/
          fi

      - name: Security (gitleaks)
        run: gitleaks detect --no-banner
`;

const VSCODE_SETTINGS = `{
  "editor.formatOnSave": true,
  "files.eol": "\\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true
  }
}
`;

const VSCODE_EXTENSIONS = `{
  "recommendations": [
    "EditorConfig.EditorConfig",
    "DavidAnson.vscode-markdownlint",
    "redhat.vscode-yaml",
    "tamasfe.even-better-toml",
    "exiasr.hadolint"
  ]
}
`;
