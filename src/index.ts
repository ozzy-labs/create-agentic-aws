#!/usr/bin/env node

import { resolve } from "node:path";

import * as p from "@clack/prompts";
import pc from "picocolors";

import { runWizard } from "./cli.js";
import { generate } from "./generator.js";
import type { Locale } from "./i18n/index.js";
import { detectLocale, setLocale, t } from "./i18n/index.js";
import { createRegistry } from "./presets/registry.js";
import { renderTree } from "./tree.js";
import { writeFiles } from "./utils.js";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  dryRun: boolean;
  lang?: Locale;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false };

  for (const arg of argv.slice(2)) {
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg.startsWith("--lang=")) {
      const lang = arg.slice("--lang=".length);
      if (lang === "en" || lang === "ja") {
        args.lang = lang;
      }
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // Set locale
  if (args.lang) {
    setLocale(args.lang);
  } else {
    setLocale(detectLocale());
  }

  // Run wizard
  const answers = await runWizard();

  // Build registry and generate
  const registry = createRegistry();
  const result = generate(answers, registry);

  if (args.dryRun) {
    // Dry-run: show file tree only
    const tree = renderTree(answers.projectName, [...result.files.keys()]);
    p.note(tree, "Files to generate (dry-run)");
  } else {
    // Write files
    const outputDir = resolve(process.cwd(), answers.projectName);
    writeFiles(result, outputDir);

    p.outro(pc.green(t("outro")));
    p.log.info(t("outroNext"));
    p.log.info(t("outroNextCd", { projectName: answers.projectName }));
    p.log.info(t("outroNextSetup"));
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
