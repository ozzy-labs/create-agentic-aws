import type { MessageKey } from "./en.js";
import { en } from "./en.js";
import { ja } from "./ja.js";

// ---------------------------------------------------------------------------
// Supported locales
// ---------------------------------------------------------------------------

export type Locale = "en" | "ja";

const messages: Record<Locale, Record<MessageKey, string>> = { en, ja };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentLocale: Locale = "en";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Set the active locale. */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

/** Get the active locale. */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Detect locale from environment variables.
 * Checks LANG and LC_ALL — defaults to "en".
 */
export function detectLocale(): Locale {
  const env = process.env.LC_ALL || process.env.LANG || "";
  if (env.startsWith("ja")) return "ja";
  return "en";
}

/**
 * Translate a message key, optionally interpolating `{{key}}` placeholders.
 */
export function t(key: MessageKey, vars?: Record<string, string>): string {
  const template = messages[currentLocale][key] ?? messages.en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, k: string) => vars[k] ?? match);
}

// Re-export types
export type { MessageKey };
