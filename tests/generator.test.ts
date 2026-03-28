import { describe, expect, it } from "vitest";

import { generate, resolvePresets } from "../src/generator.js";
import type { Preset, PresetName, WizardAnswers } from "../src/types.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "cdk",
    compute: [],
    ai: [],
    data: [],
    integration: [],
    networking: [],
    security: [],
    observability: [],
    languages: [],
    ...overrides,
  };
}

function makePreset(name: PresetName, overrides: Partial<Preset> = {}): Preset {
  return {
    name,
    files: {},
    merge: {},
    ...overrides,
  };
}

function makeRegistry(...presets: Preset[]): Map<PresetName, Preset> {
  return new Map(presets.map((p) => [p.name, p]));
}

// ---------------------------------------------------------------------------
// resolvePresets
// ---------------------------------------------------------------------------

describe("resolvePresets", () => {
  it("always includes base", () => {
    const registry = makeRegistry(makePreset("base"), makePreset("cdk"));
    const result = resolvePresets(makeAnswers(), registry);
    expect(result.map((p) => p.name)).toContain("base");
  });

  it("includes selected presets from answers", () => {
    const registry = makeRegistry(
      makePreset("base"),
      makePreset("cdk"),
      makePreset("lambda"),
      makePreset("claude-code"),
    );
    const result = resolvePresets(
      makeAnswers({ compute: ["lambda"], agents: ["claude-code"] }),
      registry,
    );
    const names = result.map((p) => p.name);
    expect(names).toContain("lambda");
    expect(names).toContain("claude-code");
  });

  it("auto-resolves VPC when ECS is selected", () => {
    const registry = makeRegistry(
      makePreset("base"),
      makePreset("cdk"),
      makePreset("ecs"),
      makePreset("vpc"),
    );
    const result = resolvePresets(makeAnswers({ compute: ["ecs"] }), registry);
    expect(result.map((p) => p.name)).toContain("vpc");
  });

  it("auto-resolves VPC when Aurora is selected", () => {
    const registry = makeRegistry(
      makePreset("base"),
      makePreset("cdk"),
      makePreset("aurora"),
      makePreset("vpc"),
    );
    const result = resolvePresets(makeAnswers({ data: ["aurora"] }), registry);
    expect(result.map((p) => p.name)).toContain("vpc");
  });

  it("auto-resolves VPC when Lambda vpcPlacement is true", () => {
    const registry = makeRegistry(
      makePreset("base"),
      makePreset("cdk"),
      makePreset("lambda"),
      makePreset("vpc"),
    );
    const result = resolvePresets(
      makeAnswers({ compute: ["lambda"], lambdaOptions: { vpcPlacement: true } }),
      registry,
    );
    expect(result.map((p) => p.name)).toContain("vpc");
  });

  it("does not auto-resolve VPC when Lambda vpcPlacement is false", () => {
    const registry = makeRegistry(
      makePreset("base"),
      makePreset("cdk"),
      makePreset("lambda"),
      makePreset("vpc"),
    );
    const result = resolvePresets(
      makeAnswers({ compute: ["lambda"], lambdaOptions: { vpcPlacement: false } }),
      registry,
    );
    expect(result.map((p) => p.name)).not.toContain("vpc");
  });

  it("resolves transitive requires dependencies", () => {
    const registry = makeRegistry(
      makePreset("base"),
      makePreset("cdk", { requires: ["typescript"] }),
      makePreset("typescript"),
    );
    const result = resolvePresets(makeAnswers({ iac: "cdk" }), registry);
    expect(result.map((p) => p.name)).toContain("typescript");
  });

  it("sorts by canonical preset order", () => {
    const registry = makeRegistry(
      makePreset("base"),
      makePreset("cdk"),
      makePreset("lambda"),
      makePreset("typescript"),
      makePreset("claude-code"),
    );
    const result = resolvePresets(
      makeAnswers({
        compute: ["lambda"],
        agents: ["claude-code"],
        languages: ["typescript"],
      }),
      registry,
    );
    const names = result.map((p) => p.name);
    expect(names.indexOf("base")).toBeLessThan(names.indexOf("typescript"));
    expect(names.indexOf("typescript")).toBeLessThan(names.indexOf("claude-code"));
    expect(names.indexOf("claude-code")).toBeLessThan(names.indexOf("cdk"));
    expect(names.indexOf("cdk")).toBeLessThan(names.indexOf("lambda"));
  });

  it("skips presets not in registry", () => {
    const registry = makeRegistry(makePreset("base"), makePreset("cdk"));
    const result = resolvePresets(makeAnswers({ compute: ["lambda"] }), registry);
    expect(result.map((p) => p.name)).not.toContain("lambda");
  });
});

// ---------------------------------------------------------------------------
// generate — owned files
// ---------------------------------------------------------------------------

describe("generate — owned files", () => {
  it("collects owned files from presets", () => {
    const registry = makeRegistry(
      makePreset("base", { files: { ".gitignore": "node_modules/\n" } }),
      makePreset("cdk", { files: { "infra/cdk.json": "{}\n" } }),
    );
    const result = generate(makeAnswers(), registry);
    expect(result.hasFile(".gitignore")).toBe(true);
    expect(result.hasFile("infra/cdk.json")).toBe(true);
  });

  it("substitutes {{projectName}} in file content", () => {
    const registry = makeRegistry(
      makePreset("base", {
        files: { "package.json": '{"name": "{{projectName}}"}\n' },
      }),
      makePreset("cdk"),
    );
    const result = generate(makeAnswers({ projectName: "test-app" }), registry);
    expect(result.readText("package.json")).toContain("test-app");
  });
});

// ---------------------------------------------------------------------------
// generate — IaC contributions
// ---------------------------------------------------------------------------

describe("generate — IaC contributions", () => {
  it("collects CDK files when IaC is cdk", () => {
    const registry = makeRegistry(
      makePreset("base"),
      makePreset("cdk"),
      makePreset("lambda", {
        iacContributions: {
          cdk: { files: { "infra/lib/constructs/lambda.ts": "// lambda construct\n" } },
          terraform: { files: { "infra/lambda.tf": "# lambda tf\n" } },
        },
      }),
    );
    const result = generate(makeAnswers({ iac: "cdk", compute: ["lambda"] }), registry);
    expect(result.hasFile("infra/lib/constructs/lambda.ts")).toBe(true);
    expect(result.hasFile("infra/lambda.tf")).toBe(false);
  });

  it("collects Terraform files when IaC is terraform", () => {
    const registry = makeRegistry(
      makePreset("base"),
      makePreset("terraform"),
      makePreset("lambda", {
        iacContributions: {
          cdk: { files: { "infra/lib/constructs/lambda.ts": "// lambda construct\n" } },
          terraform: { files: { "infra/lambda.tf": "# lambda tf\n" } },
        },
      }),
    );
    const result = generate(makeAnswers({ iac: "terraform", compute: ["lambda"] }), registry);
    expect(result.hasFile("infra/lambda.tf")).toBe(true);
    expect(result.hasFile("infra/lib/constructs/lambda.ts")).toBe(false);
  });

  it("merges IaC merge contributions to shared files", () => {
    const registry = makeRegistry(
      makePreset("base"),
      makePreset("cdk", {
        files: { "infra/package.json": '{"name": "infra"}\n' },
      }),
      makePreset("lambda", {
        iacContributions: {
          cdk: {
            files: {},
            merge: {
              "infra/package.json": { dependencies: { "aws-cdk-lib": "^2.0.0" } },
            },
          },
        },
      }),
    );
    const result = generate(makeAnswers({ iac: "cdk", compute: ["lambda"] }), registry);
    const pkg = result.readJson<Record<string, unknown>>("infra/package.json");
    expect(pkg.name).toBe("infra");
    expect(pkg.dependencies).toEqual({ "aws-cdk-lib": "^2.0.0" });
  });
});

// ---------------------------------------------------------------------------
// generate — shared file merge
// ---------------------------------------------------------------------------

describe("generate — shared file merge", () => {
  it("deep merges contributions to shared files", () => {
    const registry = makeRegistry(
      makePreset("base", {
        files: { "package.json": '{"name": "{{projectName}}", "scripts": {}}\n' },
        merge: { "package.json": { devDependencies: { vitest: "^4.0.0" } } },
      }),
      makePreset("cdk"),
      makePreset("typescript", {
        merge: { "package.json": { devDependencies: { typescript: "^5.0.0" } } },
      }),
    );
    const result = generate(makeAnswers({ languages: ["typescript"] }), registry);
    const pkg = result.readJson<Record<string, unknown>>("package.json");
    expect(pkg.name).toBe("my-project");
    const devDeps = pkg.devDependencies as Record<string, string>;
    expect(devDeps.vitest).toBe("^4.0.0");
    expect(devDeps.typescript).toBe("^5.0.0");
  });

  it("creates shared file from patches when no base exists", () => {
    const registry = makeRegistry(
      makePreset("base", {
        merge: { ".vscode/settings.json": { "editor.formatOnSave": true } },
      }),
      makePreset("cdk"),
    );
    const result = generate(makeAnswers(), registry);
    // mergeJson with empty base "{}" should still produce a valid JSON
    // Actually mergeFile receives "" as base for JSON, which would fail.
    // The merge engine handles this — if base is "", mergeJson will parse it.
    // Let's verify it exists.
    expect(result.hasFile(".vscode/settings.json")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generate — MCP server distribution
// ---------------------------------------------------------------------------

describe("generate — MCP servers", () => {
  it("distributes MCP servers to selected agent configs", () => {
    const registry = makeRegistry(
      makePreset("base", {
        mcpServers: {
          "aws-iac": { command: "npx", args: ["@anthropic/aws-iac-mcp"] },
        },
      }),
      makePreset("cdk"),
      makePreset("claude-code"),
    );
    const result = generate(makeAnswers({ agents: ["claude-code"] }), registry);
    expect(result.hasFile(".mcp.json")).toBe(false);
    const config = result.readJson<{ mcpServers: Record<string, unknown> }>(".mcp.json.example");
    expect(config.mcpServers["aws-iac"]).toBeDefined();
  });

  it("does not create agent config when no agents selected", () => {
    const registry = makeRegistry(
      makePreset("base", {
        mcpServers: {
          "aws-iac": { command: "npx", args: ["@anthropic/aws-iac-mcp"] },
        },
      }),
      makePreset("cdk"),
    );
    const result = generate(makeAnswers({ agents: [] }), registry);
    expect(result.hasFile(".mcp.json")).toBe(false);
  });

  it("distributes to multiple agents", () => {
    const registry = makeRegistry(
      makePreset("base", {
        mcpServers: { fetch: { command: "npx", args: ["@anthropic/fetch-mcp"] } },
      }),
      makePreset("cdk"),
      makePreset("claude-code"),
      makePreset("copilot"),
    );
    const result = generate(makeAnswers({ agents: ["claude-code", "copilot"] }), registry);
    expect(result.hasFile(".mcp.json")).toBe(false);
    expect(result.hasFile(".mcp.json.example")).toBe(true);
    expect(result.hasFile(".github/copilot-mcp.json")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generate — Markdown expansion
// ---------------------------------------------------------------------------

describe("generate — Markdown expansion", () => {
  it("injects sections into markdown templates", () => {
    const registry = makeRegistry(
      makePreset("base", {
        files: { "README.md": "# {{projectName}}\n\n## Tech Stack\n\nBase tools.\n" },
      }),
      makePreset("cdk"),
      makePreset("typescript", {
        markdown: {
          "README.md": [{ heading: "## Tech Stack", content: "- TypeScript" }],
        },
      }),
    );
    const result = generate(makeAnswers({ languages: ["typescript"] }), registry);
    const readme = result.readText("README.md");
    expect(readme).toBeDefined();
    expect(readme).toContain("my-project");
    expect(readme).toContain("- TypeScript");
  });

  it("handles markdown for non-existent file (creates new)", () => {
    const registry = makeRegistry(
      makePreset("base"),
      makePreset("cdk"),
      makePreset("claude-code", {
        markdown: {
          "CLAUDE.md": [{ heading: "## Commands", content: "pnpm test" }],
        },
      }),
    );
    const result = generate(makeAnswers({ agents: ["claude-code"] }), registry);
    expect(result.hasFile("CLAUDE.md")).toBe(true);
    expect(result.readText("CLAUDE.md")).toContain("pnpm test");
  });
});

// ---------------------------------------------------------------------------
// generate — GenerateResult helpers
// ---------------------------------------------------------------------------

describe("GenerateResult", () => {
  it("readJson parses JSON files", () => {
    const registry = makeRegistry(
      makePreset("base", { files: { "data.json": '{"key": "value"}\n' } }),
      makePreset("cdk"),
    );
    const result = generate(makeAnswers(), registry);
    expect(result.readJson("data.json")).toEqual({ key: "value" });
  });

  it("readJson throws for missing files", () => {
    const registry = makeRegistry(makePreset("base"), makePreset("cdk"));
    const result = generate(makeAnswers(), registry);
    expect(() => result.readJson("missing.json")).toThrow("File not found");
  });

  it("readText returns undefined for missing files", () => {
    const registry = makeRegistry(makePreset("base"), makePreset("cdk"));
    const result = generate(makeAnswers(), registry);
    expect(result.readText("missing.txt")).toBeUndefined();
  });

  it("readYaml parses YAML files", () => {
    const registry = makeRegistry(
      makePreset("base", { files: { "config.yaml": "key: value\nnested:\n  a: 1\n" } }),
      makePreset("cdk"),
    );
    const result = generate(makeAnswers(), registry);
    expect(result.readYaml("config.yaml")).toEqual({ key: "value", nested: { a: 1 } });
  });

  it("readYaml throws for missing files", () => {
    const registry = makeRegistry(makePreset("base"), makePreset("cdk"));
    const result = generate(makeAnswers(), registry);
    expect(() => result.readYaml("missing.yaml")).toThrow("File not found");
  });

  it("readToml parses TOML files", () => {
    const registry = makeRegistry(
      makePreset("base", { files: { "config.toml": '[tools]\nnode = "22"\n' } }),
      makePreset("cdk"),
    );
    const result = generate(makeAnswers(), registry);
    const toml = result.readToml<{ tools: { node: string } }>("config.toml");
    expect(toml.tools.node).toBe("22");
  });

  it("readToml throws for missing files", () => {
    const registry = makeRegistry(makePreset("base"), makePreset("cdk"));
    const result = generate(makeAnswers(), registry);
    expect(() => result.readToml("missing.toml")).toThrow("File not found");
  });
});
