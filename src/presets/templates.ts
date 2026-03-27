import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Finds the package root by walking up from the current file
 * until we find a directory containing package.json.
 * Works both from source (src/presets/) and bundled output (dist/).
 */
function findPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error("Could not find package root (no package.json found)");
}

const TEMPLATES_ROOT = resolve(findPackageRoot(), "templates");

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
