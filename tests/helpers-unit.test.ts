import { describe, expect, it } from "vitest";

import {
  defaultEmptyContent,
  requireFile,
  safeReplace,
  safeReplaceAll,
  substituteVars,
} from "../src/generator/helpers.js";

describe("substituteVars", () => {
  it("replaces {{key}} placeholders", () => {
    expect(substituteVars("Hello {{name}}", { name: "world" })).toBe("Hello world");
  });

  it("leaves unmatched placeholders intact", () => {
    expect(substituteVars("{{unknown}}", {})).toBe("{{unknown}}");
  });
});

describe("requireFile", () => {
  it("returns file content when present", () => {
    const files = new Map([["a.ts", "content"]]);
    expect(requireFile(files, "a.ts", "test")).toBe("content");
  });

  it("throws when file is missing", () => {
    const files = new Map<string, string>();
    expect(() => requireFile(files, "missing.ts", "ctx")).toThrow(
      '[ctx] Required file not found: "missing.ts"',
    );
  });
});

describe("safeReplace", () => {
  it("replaces first occurrence", () => {
    expect(safeReplace("aaa", "a", "b", "ctx")).toBe("baa");
  });

  it("throws when pattern not found", () => {
    expect(() => safeReplace("abc", "x", "y", "ctx")).toThrow(
      "[ctx] Replacement pattern not found",
    );
  });
});

describe("safeReplaceAll", () => {
  it("replaces all occurrences", () => {
    expect(safeReplaceAll("aaa", "a", "b", "ctx")).toBe("bbb");
  });

  it("throws when pattern not found", () => {
    expect(() => safeReplaceAll("abc", "x", "y", "ctx")).toThrow(
      "[ctx] Replacement pattern not found",
    );
  });
});

describe("defaultEmptyContent", () => {
  it("returns {} for .json", () => {
    expect(defaultEmptyContent("file.json")).toBe("{}");
  });

  it("returns {} for .jsonc", () => {
    expect(defaultEmptyContent("file.jsonc")).toBe("{}");
  });

  it("returns empty string for .yaml", () => {
    expect(defaultEmptyContent("file.yaml")).toBe("");
  });

  it("returns empty string for unknown extension", () => {
    expect(defaultEmptyContent("file.txt")).toBe("");
  });
});
