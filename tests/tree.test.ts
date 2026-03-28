import { describe, expect, it, vi } from "vitest";

// Mock picocolors to return plain strings
vi.mock("picocolors", () => ({
  default: {
    bold: (s: string) => s,
    cyan: (s: string) => s,
    dim: (s: string) => s,
  },
}));

import { renderTree } from "../src/tree.js";

describe("renderTree", () => {
  it("renders a simple flat file list", () => {
    const result = renderTree("my-project", [".gitignore", "package.json", "README.md"]);
    expect(result).toContain("my-project/");
    expect(result).toContain(".gitignore");
    expect(result).toContain("package.json");
    expect(result).toContain("README.md");
  });

  it("renders nested directories", () => {
    const result = renderTree("app", ["src/index.ts", "src/types.ts", "package.json"]);
    expect(result).toContain("app/");
    expect(result).toContain("src/");
    expect(result).toContain("index.ts");
    expect(result).toContain("types.ts");
  });

  it("handles empty file list", () => {
    const result = renderTree("empty", []);
    expect(result).toContain("empty/");
  });

  it("sorts files alphabetically", () => {
    const result = renderTree("proj", ["z.txt", "a.txt", "m.txt"]);
    const lines = result.split("\n");
    const aIndex = lines.findIndex((l) => l.includes("a.txt"));
    const mIndex = lines.findIndex((l) => l.includes("m.txt"));
    const zIndex = lines.findIndex((l) => l.includes("z.txt"));
    expect(aIndex).toBeLessThan(mIndex);
    expect(mIndex).toBeLessThan(zIndex);
  });
});
