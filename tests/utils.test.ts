import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { GenerateResult } from "../src/types.js";
import { writeFiles } from "../src/utils.js";

const TEST_OUTPUT = join(import.meta.dirname, ".test-output");

afterEach(() => {
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
});

describe("writeFiles", () => {
  it("writes files to disk", () => {
    const files = new Map([
      ["package.json", '{"name": "test"}\n'],
      [".gitignore", "node_modules/\n"],
    ]);
    const result = new GenerateResult(files);
    writeFiles(result, TEST_OUTPUT);

    expect(existsSync(join(TEST_OUTPUT, "package.json"))).toBe(true);
    expect(readFileSync(join(TEST_OUTPUT, "package.json"), "utf-8")).toBe('{"name": "test"}\n');
    expect(existsSync(join(TEST_OUTPUT, ".gitignore"))).toBe(true);
  });

  it("creates nested directories", () => {
    const files = new Map([["src/presets/base.ts", "export {};\n"]]);
    const result = new GenerateResult(files);
    writeFiles(result, TEST_OUTPUT);

    expect(existsSync(join(TEST_OUTPUT, "src/presets/base.ts"))).toBe(true);
    expect(readFileSync(join(TEST_OUTPUT, "src/presets/base.ts"), "utf-8")).toBe("export {};\n");
  });
});
