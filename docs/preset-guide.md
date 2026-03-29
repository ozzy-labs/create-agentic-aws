# Preset Development Guide

How to add a new AWS service preset to `create-agentic-aws`.

## Overview

Each preset is a self-contained module that declares:

- **Owned files** — files exclusively owned by this preset
- **Merge contributions** — patches deep-merged into shared files
- **IaC contributions** — CDK constructs and/or Terraform resources
- **Markdown sections** — injected into README and other docs
- **MCP servers** — distributed to agent config files

## Preset Interface

```typescript
interface Preset {
  name: PresetName;
  requires?: readonly PresetName[];
  files: Record<string, string>;
  merge: Record<string, unknown>;
  iacContributions?: {
    cdk?: IacContribution;
    terraform?: IacContribution;
  };
  markdown?: Record<string, MarkdownSection[]>;
  ciSteps?: CiContribution;
  setupExtra?: string;
  mcpServers?: Record<string, McpServerConfig>;
}
```

## Step-by-Step

### 1. Add the preset name

Add your service name to the appropriate union type in `src/types.ts`:

```typescript
// Example: adding "elasticache" to DataPresetName
export type DataPresetName = "s3" | "dynamodb" | "aurora" | "rds" | "elasticache";
```

Also add it to the `PresetName` union if it belongs to a new category.

### 2. Create template files

Create `templates/<preset-name>/` with any files the preset owns:

```text
templates/elasticache/
  lib/elasticache/
    client.ts      # Application code
```

Use `{{projectName}}` for project name placeholders. The template loader
(`readTemplates()`) recursively reads all files and maps them by relative path.

### 3. Create the preset module

Create `src/presets/<preset-name>.ts`:

```typescript
import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

// Inline IaC resources (CDK construct, Terraform HCL)
const ELASTICACHE_CONSTRUCT = `...`;
const ELASTICACHE_TF = `...`;

export function createElastiCachePreset(): Preset {
  const templates = readTemplates("elasticache");

  return {
    name: "elasticache",

    // Optional: auto-resolve dependencies
    requires: ["vpc"],

    files: {
      ...templates,
    },

    merge: {
      "package.json": {
        dependencies: {
          "ioredis": "^5.0.0",
        },
      },
    },

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/elasticache.ts": ELASTICACHE_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { ElastiCache } from "./constructs/elasticache";',
            constructs: '    new ElastiCache(this, "ElastiCache");',
          },
        },
      },
      terraform: {
        files: {
          "infra/elasticache.tf": ELASTICACHE_TF,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon ElastiCache**: In-memory cache (Redis)",
        },
      ],
    },
  };
}
```

### 4. Register the preset

Add the preset to `src/presets/registry.ts`:

```typescript
import { createElastiCachePreset } from "./elasticache.js";

// Inside createRegistry():
createElastiCachePreset(),
```

Add it to `PRESET_ORDER` in `src/generator/resolve.ts` at the appropriate position.

### 5. Add CLI wizard options

In `src/cli.ts`, add the option to the relevant multiselect prompt
and handle any sub-options if needed.

### 6. Write tests

Create `tests/presets/<preset-name>.test.ts` following the A1 pattern:

```typescript
import { describe, expect, it } from "vitest";
import { generate } from "../../src/generator.js";
// ... imports

describe("<preset-name> preset", () => {
  const preset = createMyPreset();

  it("has correct name", () => {
    expect(preset.name).toBe("<preset-name>");
  });

  describe("owned files", () => {
    // Verify template files exist and contain expected content
  });

  describe("iac contributions (cdk)", () => {
    // Verify CDK construct files and merge markers
  });

  describe("merge contributions", () => {
    // Verify shared file patches (package.json, etc.)
  });

  describe("integration with generator", () => {
    // Verify end-to-end generation produces expected output
  });
});
```

## Owned Files vs Merge Contributions

| Aspect | Owned files (`files`) | Merge contributions (`merge`) |
|--------|----------------------|-------------------------------|
| Ownership | Exclusive to this preset | Shared across presets |
| Conflict | Last writer wins (silent) | Deep-merged |
| Use for | Application code, configs | package.json, CI, VSCode |
| Substitution | `{{projectName}}` supported | Not substituted |

## IaC Contributions

Each service should provide both CDK and Terraform implementations:

- **CDK**: TypeScript construct in `infra/lib/constructs/<name>.ts`, merged into
  `infra/lib/app-stack.ts` via `[merge: imports]` and `[merge: constructs]` markers
- **Terraform**: HCL resource in `infra/<name>.tf`, optionally merged into
  `infra/outputs.tf` and `infra/variables.tf`

## Dependencies (`requires`)

Use `requires` when your preset needs another preset to function:

```typescript
requires: ["vpc"],  // Auto-includes VPC when this preset is selected
```

The registry validates on startup that:

- All referenced presets exist
- No circular dependencies exist

## Canonical Order

Presets are applied in the order defined in `PRESET_ORDER` (src/generator/resolve.ts):

```text
base → languages → agents → iac → compute → vpc → data →
integration → networking → security → observability
```

Place your preset in the appropriate category position.
