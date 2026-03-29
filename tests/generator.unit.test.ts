import { describe, expect, it } from "vitest";

import {
  collectIacContributions,
  expandMarkdownTemplates,
  stripMergeMarkers,
} from "../src/generator/finalize.js";
import { resolvePresets } from "../src/generator/resolve.js";
import { createRegistry } from "../src/presets/registry.js";
import type { Preset, WizardAnswers } from "../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "test",
    agents: [],
    iac: "cdk",
    compute: [],
    ai: [],
    data: [],
    dataPipeline: [],
    integration: [],
    networking: [],
    security: [],
    observability: [],
    languages: [],
    ...overrides,
  };
}

const registry = createRegistry();

// ---------------------------------------------------------------------------
// resolvePresets
// ---------------------------------------------------------------------------

describe("resolvePresets", () => {
  it("always includes base preset", () => {
    const presets = resolvePresets(makeAnswers(), registry);
    expect(presets[0].name).toBe("base");
  });

  it("auto-resolves vpc for ecs", () => {
    const presets = resolvePresets(makeAnswers({ compute: ["ecs"] }), registry);
    const names = presets.map((p) => p.name);
    expect(names).toContain("vpc");
  });

  it("auto-resolves vpc for aurora", () => {
    const presets = resolvePresets(makeAnswers({ data: ["aurora"] }), registry);
    const names = presets.map((p) => p.name);
    expect(names).toContain("vpc");
  });

  it("resolves transitive dependencies", () => {
    const presets = resolvePresets(makeAnswers({ ai: ["bedrock-agents"] }), registry);
    const names = presets.map((p) => p.name);
    expect(names).toContain("bedrock-kb");
    expect(names).toContain("bedrock");
    expect(names).toContain("opensearch");
  });

  it("returns presets in deterministic order", () => {
    const p1 = resolvePresets(makeAnswers({ compute: ["lambda"], data: ["s3"] }), registry);
    const p2 = resolvePresets(makeAnswers({ data: ["s3"], compute: ["lambda"] }), registry);
    expect(p1.map((p) => p.name)).toEqual(p2.map((p) => p.name));
  });
});

// ---------------------------------------------------------------------------
// collectIacContributions
// ---------------------------------------------------------------------------

describe("collectIacContributions", () => {
  it("collects CDK construct files", () => {
    const preset: Preset = {
      name: "lambda",
      files: {},
      merge: {},
      iacContributions: {
        cdk: {
          files: { "infra/lib/constructs/test.ts": "test content" },
        },
      },
    };
    const files = new Map<string, string>();
    collectIacContributions([preset], "cdk", files, { projectName: "test" });
    expect(files.get("infra/lib/constructs/test.ts")).toBe("test content");
  });

  it("does not collect terraform files when iac is cdk", () => {
    const preset: Preset = {
      name: "lambda",
      files: {},
      merge: {},
      iacContributions: {
        terraform: {
          files: { "infra/test.tf": "resource {}" },
        },
      },
    };
    const files = new Map<string, string>();
    collectIacContributions([preset], "cdk", files, { projectName: "test" });
    expect(files.has("infra/test.tf")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stripMergeMarkers
// ---------------------------------------------------------------------------

describe("stripMergeMarkers", () => {
  it("removes // [merge: ...] lines from .ts files", () => {
    const files = new Map([
      ["app.ts", "import foo;\n// [merge: imports]\nconst x = 1;\n// [merge: constructs]\n"],
    ]);
    stripMergeMarkers(files);
    expect(files.get("app.ts")).not.toContain("[merge:");
  });

  it("does not modify non-ts files", () => {
    const content = "# [merge: test]\n";
    const files = new Map([["file.md", content]]);
    stripMergeMarkers(files);
    expect(files.get("file.md")).toBe(content);
  });
});

// ---------------------------------------------------------------------------
// expandMarkdownTemplates
// ---------------------------------------------------------------------------

describe("expandMarkdownTemplates", () => {
  it("injects markdown sections under headings", () => {
    const preset: Preset = {
      name: "lambda",
      files: {},
      merge: {},
      markdown: {
        "README.md": [{ heading: "## Tech Stack", content: "- Lambda" }],
      },
    };
    const files = new Map([["README.md", "# App\n\n## Tech Stack\n\n## License\n"]]);
    expandMarkdownTemplates([preset], files);
    expect(files.get("README.md")).toContain("- Lambda");
  });
});
