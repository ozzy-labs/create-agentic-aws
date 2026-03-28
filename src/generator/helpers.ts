export function substituteVars(content: string, vars: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

export function defaultEmptyContent(path: string): string {
  if (path.endsWith(".json") || path.endsWith(".jsonc")) return "{}";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "";
  if (path.endsWith(".toml")) return "";
  return "";
}
