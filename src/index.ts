#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { parseArgs as nodeParseArgs } from "node:util";

import * as p from "@clack/prompts";
import pc from "picocolors";

import { runWizard } from "./cli.js";
import { generate } from "./generator/index.js";
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
      help: { type: "boolean", default: false, short: "h" },
      version: { type: "boolean", default: false, short: "v" },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (values.version) {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as {
      version: string;
    };
    console.log(pkg.version);
    process.exit(0);
  }

  const positionalArg = positionals[0];
  const lang = values.lang as string | undefined;

  return {
    dryRun: values["dry-run"] as boolean,
    lang: lang === "en" || lang === "ja" ? lang : undefined,
    defaultName: positionalArg ? basename(positionalArg) : undefined,
    parentDir: positionalArg ? resolve(process.cwd(), dirname(positionalArg)) : process.cwd(),
  };
}

const HELP_TEXT = `Usage: create-agentic-aws [options] [project-path]

Options:
  -h, --help           Show this help message
  -v, --version        Show version number
  --lang <en|ja>       Set UI language (default: auto-detect)
  --dry-run            Show file tree without writing files

Examples:
  create-agentic-aws my-project
  create-agentic-aws --lang=ja my-project
  create-agentic-aws --dry-run my-project`;

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

    if (existsSync(outputDir)) {
      const overwrite = await p.confirm({
        message: t("directoryExists", { path: outputDir }),
        initialValue: false,
      });
      if (p.isCancel(overwrite) || !overwrite) {
        p.cancel(t("cancelled"));
        process.exit(0);
      }
    }

    writeFiles(result, outputDir);

    const relPath =
      resolve(process.cwd(), outputDir) === resolve(process.cwd(), answers.projectName)
        ? answers.projectName
        : outputDir;

    p.outro(pc.green(t("outro")));
    p.log.info(t("outroNext"));
    p.log.info(t("outroNextCd", { projectName: relPath }));
    p.log.info(t("outroNextMiseTrust"));
    p.log.info(t("outroNextMiseInstall"));
    p.log.info(t("outroNextPnpmInstall"));
    p.log.info(t("outroNextGitInit"));
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nError: ${message}`);
  if (err instanceof Error && err.stack && process.env.DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
});
