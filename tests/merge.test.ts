import { describe, expect, it } from "vitest";

import {
  mergeFile,
  mergeHcl,
  mergeJson,
  mergeMarkdown,
  mergeText,
  mergeToml,
  mergeTypeScript,
  mergeYaml,
} from "../src/merge.js";

// ---------------------------------------------------------------------------
// JSON merge
// ---------------------------------------------------------------------------

describe("mergeJson", () => {
  it("deep merges objects", () => {
    const base = JSON.stringify({ a: 1, b: { c: 2 } });
    const result = JSON.parse(mergeJson(base, { b: { d: 3 }, e: 4 }));
    expect(result).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 4 });
  });

  it("unique unions arrays", () => {
    const base = JSON.stringify({
      devDependencies: { a: "1" },
      extensions: ["ext-a", "ext-b"],
    });
    const result = JSON.parse(mergeJson(base, { extensions: ["ext-b", "ext-c"] }));
    expect(result.extensions).toEqual(["ext-a", "ext-b", "ext-c"]);
  });

  it("unique unions arrays of objects", () => {
    const base = JSON.stringify({ items: [{ name: "a" }] });
    const result = JSON.parse(mergeJson(base, { items: [{ name: "a" }, { name: "b" }] }));
    expect(result.items).toEqual([{ name: "a" }, { name: "b" }]);
  });

  it("returns base when no patches", () => {
    const base = JSON.stringify({ a: 1 });
    expect(mergeJson(base)).toBe(base);
  });

  it("merges multiple patches in order", () => {
    const base = JSON.stringify({ a: 1 });
    const result = JSON.parse(mergeJson(base, { b: 2 }, { c: 3 }));
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("later patch overrides earlier for same key", () => {
    const base = JSON.stringify({ a: 1 });
    const result = JSON.parse(mergeJson(base, { a: 2 }, { a: 3 }));
    expect(result.a).toBe(3);
  });

  it("outputs trailing newline", () => {
    const result = mergeJson("{}", { a: 1 });
    expect(result.endsWith("\n")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// YAML merge
// ---------------------------------------------------------------------------

describe("mergeYaml", () => {
  it("deep merges objects", () => {
    const base = "a: 1\nb:\n  c: 2\n";
    const result = mergeYaml(base, { b: { d: 3 } });
    expect(result).toContain("d: 3");
    expect(result).toContain("c: 2");
  });

  it("unique unions arrays", () => {
    const base = "items:\n  - a\n  - b\n";
    const result = mergeYaml(base, { items: ["b", "c"] });
    expect(result).toContain("- a");
    expect(result).toContain("- b");
    expect(result).toContain("- c");
    // "b" should appear only once
    expect(result.match(/- b/g)?.length).toBe(1);
  });

  it("returns base when no patches", () => {
    const base = "a: 1\n";
    expect(mergeYaml(base)).toBe(base);
  });
});

// ---------------------------------------------------------------------------
// TOML merge
// ---------------------------------------------------------------------------

describe("mergeToml", () => {
  it("deep merges objects", () => {
    const base = "[tools]\nnode = '22'\n";
    const result = mergeToml(base, { tools: { python: "3.12" } });
    expect(result).toContain("node");
    expect(result).toContain("python");
  });

  it("returns base when no patches", () => {
    const base = "a = 1\n";
    expect(mergeToml(base)).toBe(base);
  });
});

// ---------------------------------------------------------------------------
// Text merge
// ---------------------------------------------------------------------------

describe("mergeText", () => {
  it("appends new lines with dedup", () => {
    const base = "node_modules/\ndist/\n";
    const result = mergeText(base, "dist/\n.env\n");
    expect(result).toContain("node_modules/");
    expect(result).toContain(".env");
    // "dist/" should appear only once
    expect(result.match(/dist\//g)?.length).toBe(1);
  });

  it("separates blocks with blank line", () => {
    const base = "node_modules/\n";
    const result = mergeText(base, ".env\n");
    const lines = result.split("\n");
    const envIndex = lines.indexOf(".env");
    expect(envIndex).toBeGreaterThan(0);
    expect(lines[envIndex - 1]).toBe("");
  });

  it("returns base when no blocks", () => {
    const base = "node_modules/\n";
    expect(mergeText(base)).toBe(base);
  });

  it("ensures trailing newline", () => {
    const result = mergeText("a", "b");
    expect(result.endsWith("\n")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Markdown merge
// ---------------------------------------------------------------------------

describe("mergeMarkdown", () => {
  it("injects content under matching heading", () => {
    const template = "# Title\n\nIntro.\n\n## Tech Stack\n\nBase tools.\n\n## License\n\nMIT\n";
    const result = mergeMarkdown(template, [{ heading: "## Tech Stack", content: "- TypeScript" }]);
    expect(result).toContain("Base tools.");
    expect(result).toContain("- TypeScript");
    // Content should appear before License
    const tsIndex = result.indexOf("- TypeScript");
    const licenseIndex = result.indexOf("## License");
    expect(tsIndex).toBeLessThan(licenseIndex);
  });

  it("injects from multiple sections", () => {
    const template = "# Title\n\n## A\n\nA content.\n\n## B\n\nB content.\n";
    const result = mergeMarkdown(template, [
      { heading: "## A", content: "Extra A." },
      { heading: "## B", content: "Extra B." },
    ]);
    expect(result).toContain("Extra A.");
    expect(result).toContain("Extra B.");
  });

  it("appends section if heading not found", () => {
    const template = "# Title\n\nIntro.\n";
    const result = mergeMarkdown(template, [
      { heading: "## New Section", content: "New content." },
    ]);
    expect(result).toContain("## New Section");
    expect(result).toContain("New content.");
  });

  it("returns template when no sections", () => {
    const template = "# Title\n";
    expect(mergeMarkdown(template, [])).toBe(template);
  });

  it("respects heading levels (does not cross same-level boundary)", () => {
    const template = "## A\n\nA content.\n\n## B\n\nB content.\n";
    const result = mergeMarkdown(template, [{ heading: "## A", content: "Injected into A." }]);
    const injectedIndex = result.indexOf("Injected into A.");
    const bIndex = result.indexOf("## B");
    expect(injectedIndex).toBeLessThan(bIndex);
  });
});

// ---------------------------------------------------------------------------
// HCL merge
// ---------------------------------------------------------------------------

describe("mergeHcl", () => {
  it("appends blocks with blank line separator", () => {
    const base = 'variable "project" {\n  type = string\n}\n';
    const block = 'variable "region" {\n  type    = string\n  default = "ap-northeast-1"\n}';
    const result = mergeHcl(base, block);
    expect(result).toContain('variable "project"');
    expect(result).toContain('variable "region"');
    // Separated by blank line
    expect(result).toContain("}\n\n");
  });

  it("appends multiple blocks", () => {
    const base = "# Base\n";
    const result = mergeHcl(base, "block1 {}", "block2 {}");
    expect(result).toContain("block1 {}");
    expect(result).toContain("block2 {}");
  });

  it("returns base when no blocks", () => {
    const base = "# Base\n";
    expect(mergeHcl(base)).toBe(base);
  });

  it("ensures trailing newline", () => {
    const result = mergeHcl("base", "block");
    expect(result.endsWith("\n")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TypeScript merge
// ---------------------------------------------------------------------------

describe("mergeTypeScript", () => {
  const base = [
    'import { Construct } from "constructs";',
    "// [merge: imports]",
    "",
    "export class AppStack {",
    "  constructor(scope: Construct) {",
    "    // [merge: constructs]",
    "  }",
    "}",
  ].join("\n");

  it("injects code after marker comment", () => {
    const result = mergeTypeScript(base, {
      imports: 'import { Bucket } from "aws-cdk-lib/aws-s3";',
    });
    expect(result).toContain('import { Bucket } from "aws-cdk-lib/aws-s3";');
    const lines = result.split("\n");
    const markerIdx = lines.findIndex((l) => l.includes("// [merge: imports]"));
    expect(lines[markerIdx + 1]).toContain("Bucket");
  });

  it("injects into multiple markers", () => {
    const result = mergeTypeScript(base, {
      imports: 'import { Queue } from "aws-cdk-lib/aws-sqs";',
      constructs: "new Queue(this, 'Queue');",
    });
    expect(result).toContain("Queue");
    expect(result).toContain("new Queue");
  });

  it("accumulates multiple patches for same marker", () => {
    const result = mergeTypeScript(
      base,
      { imports: "import A from 'a';" },
      { imports: "import B from 'b';" },
    );
    expect(result).toContain("import A from 'a';");
    expect(result).toContain("import B from 'b';");
  });

  it("returns base when no patches", () => {
    expect(mergeTypeScript(base)).toBe(base);
  });

  it("skips injection when marker not found", () => {
    const result = mergeTypeScript(base, { nonexistent: "some code" });
    expect(result).toBe(base);
  });

  it("handles marker at end of file without trailing newline", () => {
    const noTrailingNewline = "// [merge: tail]";
    const result = mergeTypeScript(noTrailingNewline, { tail: "injected code" });
    expect(result).toContain("injected code");
  });
});

// ---------------------------------------------------------------------------
// File dispatcher
// ---------------------------------------------------------------------------

describe("mergeFile", () => {
  it("dispatches .json to mergeJson", () => {
    const base = JSON.stringify({ a: 1 });
    const result = mergeFile("package.json", base, [{ b: 2 }]);
    expect(JSON.parse(result)).toEqual({ a: 1, b: 2 });
  });

  it("dispatches .yaml to mergeYaml", () => {
    const base = "a: 1\n";
    const result = mergeFile("lefthook.yaml", base, [{ b: 2 }]);
    expect(result).toContain("b: 2");
  });

  it("dispatches .yml to mergeYaml", () => {
    const base = "a: 1\n";
    const result = mergeFile("ci.yml", base, [{ b: 2 }]);
    expect(result).toContain("b: 2");
  });

  it("dispatches .toml to mergeToml", () => {
    const base = "a = 1\n";
    const result = mergeFile(".mise.toml", base, [{ b: 2 }]);
    expect(result).toContain("b = 2");
  });

  it("dispatches .tf to mergeHcl", () => {
    const base = "# base\n";
    const result = mergeFile("variables.tf", base, ["variable {}"]);
    expect(result).toContain("variable {}");
  });

  it("dispatches .md to mergeMarkdown", () => {
    const base = "# Title\n\n## Section\n\nContent.\n";
    const result = mergeFile("README.md", base, [{ heading: "## Section", content: "Extra." }]);
    expect(result).toContain("Extra.");
  });

  it("defaults to text merge", () => {
    const base = "line1\n";
    const result = mergeFile(".gitignore", base, ["line2"]);
    expect(result).toContain("line1");
    expect(result).toContain("line2");
  });

  it("dispatches .ts to mergeTypeScript", () => {
    const base = "// [merge: imports]\nexport {};\n";
    const result = mergeFile("infra/lib/app-stack.ts", base, [{ imports: "import A from 'a';" }]);
    expect(result).toContain("import A from 'a';");
  });

  it("dispatches .jsonc to mergeJson", () => {
    const base = '{"a": 1}';
    const result = mergeFile("settings.jsonc", base, [{ b: 2 }]);
    expect(JSON.parse(result)).toEqual({ a: 1, b: 2 });
  });

  it("returns base when no contributions", () => {
    const base = '{"a": 1}';
    expect(mergeFile("package.json", base, [])).toBe(base);
  });
});
