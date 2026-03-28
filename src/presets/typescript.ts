import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

export function createTypescriptPreset(): Preset {
  const templates = readTemplates("typescript");

  return {
    name: "typescript",

    files: {
      ...templates,
    },

    merge: {
      "package.json": {
        scripts: {
          build: "tsc",
          typecheck: "tsc --noEmit",
          lint: "biome check .",
          "lint:fix": "biome check --write .",
        },
        devDependencies: {
          "@biomejs/biome": "^2.4.0",
          "@types/node": "^24.0.0",
          typescript: "^5.8.0",
        },
      },
      ".mise.toml": {
        tools: {
          biome: "latest",
        },
      },
      "lefthook.yaml": {
        "pre-commit": {
          commands: {
            biome: {
              glob: "*.{ts,tsx,js,jsx,json,jsonc}",
              run: "biome check --write {staged_files}",
            },
          },
        },
        "pre-push": {
          commands: {
            typecheck: {
              run: "tsc --noEmit",
            },
          },
        },
      },
      ".github/workflows/ci.yaml": {
        jobs: {
          ci: {
            steps: [
              { name: "Lint (biome)", run: "biome check ." },
              { name: "Typecheck", run: "tsc --noEmit" },
            ],
          },
        },
      },
      ".vscode/settings.json": {
        "editor.defaultFormatter": "biomejs.biome",
        "[typescript]": { "editor.defaultFormatter": "biomejs.biome" },
        "[typescriptreact]": { "editor.defaultFormatter": "biomejs.biome" },
        "[javascript]": { "editor.defaultFormatter": "biomejs.biome" },
        "[json]": { "editor.defaultFormatter": "biomejs.biome" },
        "[jsonc]": { "editor.defaultFormatter": "biomejs.biome" },
      },
      ".vscode/extensions.json": {
        recommendations: ["biomejs.biome"],
      },
      ".devcontainer/devcontainer.json": {
        customizations: {
          vscode: {
            extensions: ["biomejs.biome"],
          },
        },
      },
    },

    ciSteps: {
      lintSteps: [{ name: "Lint (biome)", run: "biome check ." }],
      buildSteps: [{ name: "Typecheck", run: "tsc --noEmit" }],
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **TypeScript**: Strict mode, ESM\n- **Biome**: Lint + format",
        },
      ],
    },
  };
}
