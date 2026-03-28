import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { GenerateResult } from "./types.js";

/**
 * Writes all generated files to disk under the given output directory.
 */
export function writeFiles(result: GenerateResult, outputDir: string): void {
  for (const [filePath, content] of result.files) {
    const fullPath = join(outputDir, filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
  }
}
