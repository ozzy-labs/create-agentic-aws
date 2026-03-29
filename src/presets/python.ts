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
          uv: "0",
          "pipx:ruff": "0",
          "pipx:mypy": "1",
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
              {
                name: "Lint (ruff)",
                run: 'if find . -name "*.py" -not -path "./node_modules/*" | head -1 | grep -q .; then ruff check .; fi',
              },
              {
                name: "Format (ruff)",
                run: 'if find . -name "*.py" -not -path "./node_modules/*" | head -1 | grep -q .; then ruff format --check .; fi',
              },
              {
                name: "Typecheck (mypy)",
                run: 'if find . -name "*.py" -not -path "./node_modules/*" | head -1 | grep -q .; then mypy .; fi',
              },
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
        {
          name: "Lint (ruff)",
          run: 'if find . -name "*.py" -not -path "./node_modules/*" | head -1 | grep -q .; then ruff check .; fi',
        },
        {
          name: "Format (ruff)",
          run: 'if find . -name "*.py" -not -path "./node_modules/*" | head -1 | grep -q .; then ruff format --check .; fi',
        },
        {
          name: "Typecheck (mypy)",
          run: 'if find . -name "*.py" -not -path "./node_modules/*" | head -1 | grep -q .; then mypy .; fi',
        },
      ],
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content:
            "- **Python**: 3.12+, strict mypy\n- **Ruff**: Lint + format\n- **uv**: Package manager",
        },
        {
          heading: "## Development",
          content:
            "```bash\nruff check .         # Lint Python\nruff format .        # Format Python\nmypy .               # Type check Python\n```",
        },
      ],
    },
  };
}
