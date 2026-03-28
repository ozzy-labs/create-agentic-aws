import { describe, expect, it } from "vitest";

import { parseArgs } from "../src/index.js";

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe("parseArgs", () => {
  it("returns defaults with no arguments", () => {
    const result = parseArgs(["node", "script"]);
    expect(result.dryRun).toBe(false);
    expect(result.lang).toBeUndefined();
    expect(result.defaultName).toBeUndefined();
    expect(result.parentDir).toBe(process.cwd());
  });

  it("parses --dry-run flag", () => {
    const result = parseArgs(["node", "script", "--dry-run"]);
    expect(result.dryRun).toBe(true);
  });

  it("parses --lang=en", () => {
    const result = parseArgs(["node", "script", "--lang=en"]);
    expect(result.lang).toBe("en");
  });

  it("parses --lang=ja", () => {
    const result = parseArgs(["node", "script", "--lang=ja"]);
    expect(result.lang).toBe("ja");
  });

  it("ignores invalid --lang value", () => {
    const result = parseArgs(["node", "script", "--lang=fr"]);
    expect(result.lang).toBeUndefined();
  });

  it("handles both --dry-run and --lang together", () => {
    const result = parseArgs(["node", "script", "--dry-run", "--lang=ja"]);
    expect(result.dryRun).toBe(true);
    expect(result.lang).toBe("ja");
  });

  it("parses positional argument as project name", () => {
    const result = parseArgs(["node", "script", "my-project"]);
    expect(result.defaultName).toBe("my-project");
    expect(result.parentDir).toBe(process.cwd());
  });

  it("extracts basename and parent dir from path argument", () => {
    const result = parseArgs(["node", "script", "path/to/my-project"]);
    expect(result.defaultName).toBe("my-project");
    expect(result.parentDir).toContain("path/to");
  });

  it("combines positional with flags", () => {
    const result = parseArgs(["node", "script", "my-project", "--dry-run", "--lang=en"]);
    expect(result.defaultName).toBe("my-project");
    expect(result.dryRun).toBe(true);
    expect(result.lang).toBe("en");
  });
});
