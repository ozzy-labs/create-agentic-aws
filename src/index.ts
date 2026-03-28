#!/usr/bin/env node

import { basename, dirname, resolve } from "node:path";
import { parseArgs as nodeParseArgs } from "node:util";

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

export interface CliArgs {
  dryRun: boolean;
  lang?: Locale;
  defaultName?: string;
  parentDir: string;
}

export function parseArgs(argv: string[]): CliArgs {
  const { values, positionals } = nodeParseArgs({
    args: argv.slice(2),
    options: {
      lang: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const positionalArg = positionals[0];
  const lang = values.lang as string | undefined;

  return {
    dryRun: values["dry-run"] as boolean,
    lang: lang === "en" || lang === "ja" ? lang : undefined,
    defaultName: positionalArg ? basename(positionalArg) : undefined,
    parentDir: positionalArg ? resolve(process.cwd(), dirname(positionalArg)) : process.cwd(),
  };
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
  const answers = await runWizard(args.defaultName);

  // Build registry and generate
  const registry = createRegistry();
  const result = generate(answers, registry);

  if (args.dryRun) {
    // Dry-run: show file tree only
    const tree = renderTree(answers.projectName, [...result.files.keys()]);
    p.note(tree, "Files to generate (dry-run)");
  } else {
    // Write files
    const outputDir = resolve(args.parentDir, answers.projectName);
    writeFiles(result, outputDir);

    const relPath =
      resolve(process.cwd(), outputDir) === resolve(process.cwd(), answers.projectName)
        ? answers.projectName
        : outputDir;

    p.outro(pc.green(t("outro")));
    p.log.info(t("outroNext"));
    p.log.info(t("outroNextCd", { projectName: relPath }));
    p.log.info(t("outroNextSetup"));
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
