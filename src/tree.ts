import pc from "picocolors";

/**
 * Renders a file tree from a list of paths.
 * Returns a formatted string suitable for terminal output.
 */
export function renderTree(projectName: string, paths: string[]): string {
  if (paths.length === 0) return pc.bold(pc.cyan(`${projectName}/`));

  const sorted = [...paths].sort();
  const lines: string[] = [pc.bold(pc.cyan(`${projectName}/`))];

  for (let i = 0; i < sorted.length; i++) {
    const parts = sorted[i].split("/");
    const prevParts = i > 0 ? sorted[i - 1].split("/") : [];

    // Find how many leading directory segments are shared with previous entry
    let shared = 0;
    for (let d = 0; d < Math.min(parts.length - 1, prevParts.length - 1); d++) {
      if (parts[d] === prevParts[d]) shared = d + 1;
      else break;
    }

    // Render new directory segments
    for (let d = shared; d < parts.length - 1; d++) {
      const indent = "│   ".repeat(d);
      lines.push(`${indent}├── ${pc.cyan(`${parts[d]}/`)}`);
    }

    // Render file
    const depth = parts.length - 1;
    const indent = "│   ".repeat(depth);
    const isLastAtDepth = !hasMoreAtDepth(sorted, i, depth);
    const connector = isLastAtDepth ? "└── " : "├── ";
    lines.push(`${indent}${connector}${parts[parts.length - 1]}`);
  }

  return lines.join("\n");
}

/** Check if there are more entries at the same directory depth after index i. */
function hasMoreAtDepth(sorted: string[], i: number, depth: number): boolean {
  const parts = sorted[i].split("/");
  for (let j = i + 1; j < sorted.length; j++) {
    const jParts = sorted[j].split("/");
    // Same parent directory?
    let sameParent = true;
    for (let d = 0; d < depth; d++) {
      if (d >= jParts.length || jParts[d] !== parts[d]) {
        sameParent = false;
        break;
      }
    }
    if (sameParent && jParts.length > depth) return true;
    if (!sameParent) return false;
  }
  return false;
}
