import { describe, expect, it } from "vitest";

import { parseArgs } from "../src/index.js";

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe("parseArgs", () => {
  it("returns defaults with no arguments", () => {
    const result = parseArgs(["node", "script"]);
    expect(result).toEqual({ dryRun: false });
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

  it("ignores unknown arguments", () => {
    const result = parseArgs(["node", "script", "--verbose", "--output=json"]);
    expect(result).toEqual({ dryRun: false });
  });
});
