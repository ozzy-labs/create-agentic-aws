import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_ROOT = resolve(__dirname, "../../templates");

/**
 * Recursively reads all files under `templates/<presetName>/`
 * and returns a map of output-relative paths to file content.
 */
export function readTemplates(presetName: string): Record<string, string> {
  const dir = join(TEMPLATES_ROOT, presetName);
  const files: Record<string, string> = {};

  function walk(currentDir: string): void {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        const relPath = relative(dir, fullPath);
        files[relPath] = readFileSync(fullPath, "utf-8");
      }
    }
  }

  walk(dir);
  return files;
}
