export function substituteVars(content: string, vars: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

export function requireFile(files: Map<string, string>, path: string, context: string): string {
  const content = files.get(path);
  if (content === undefined) {
    throw new Error(`[${context}] Required file not found: "${path}"`);
  }
  return content;
}

export function safeReplace(
  content: string,
  search: string | RegExp,
  replacement: string,
  context: string,
): string {
  const result = content.replace(search, replacement);
  if (result === content) {
    const pattern = search instanceof RegExp ? search.source : search;
    throw new Error(`[${context}] Replacement pattern not found: "${pattern.slice(0, 80)}"`);
  }
  return result;
}

export function defaultEmptyContent(path: string): string {
  if (path.endsWith(".json") || path.endsWith(".jsonc")) return "{}";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "";
  if (path.endsWith(".toml")) return "";
  return "";
}
