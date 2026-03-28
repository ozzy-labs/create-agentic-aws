import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

export function createPythonPreset(): Preset {
  const templates = readTemplates("python");

  return {
    name: "python",

    files: {
      ...templates,
    },

    merge: {
      ".mise.toml": {
        tools: {
          python: "3.12",
          uv: "latest",
          "pipx:ruff": "latest",
          "pipx:mypy": "latest",
        },
      },
      "lefthook.yaml": {
        "pre-commit": {
          commands: {
            ruff: {
              glob: "*.py",
              run: "ruff check --fix {staged_files} && ruff format {staged_files}",
            },
            mypy: {
              glob: "*.py",
              run: "mypy {staged_files}",
            },
          },
        },
      },
      ".github/workflows/ci.yaml": {
        jobs: {
          ci: {
            steps: [
              { name: "Lint (ruff)", run: "ruff check ." },
              { name: "Format (ruff)", run: "ruff format --check ." },
              { name: "Typecheck (mypy)", run: "mypy ." },
            ],
          },
        },
      },
      ".vscode/settings.json": {
        "[python]": {
          "editor.defaultFormatter": "charliermarsh.ruff",
          "editor.formatOnSave": true,
        },
        "python.analysis.typeCheckingMode": "strict",
      },
      ".vscode/extensions.json": {
        recommendations: ["charliermarsh.ruff", "ms-python.mypy-type-checker", "ms-python.python"],
      },
      ".devcontainer/devcontainer.json": {
        features: {
          "ghcr.io/devcontainers/features/python:1": { version: "3.12" },
        },
        customizations: {
          vscode: {
            extensions: ["charliermarsh.ruff", "ms-python.mypy-type-checker", "ms-python.python"],
          },
        },
      },
    },

    ciSteps: {
      lintSteps: [
        { name: "Lint (ruff)", run: "ruff check ." },
        { name: "Format (ruff)", run: "ruff format --check ." },
        { name: "Typecheck (mypy)", run: "mypy ." },
      ],
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content:
            "- **Python**: 3.12+, strict mypy\n- **Ruff**: Lint + format\n- **uv**: Package manager",
        },
      ],
    },
  };
}
