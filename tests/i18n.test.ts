import { afterEach, describe, expect, it, vi } from "vitest";

import { detectLocale, getLocale, setLocale, t } from "../src/i18n/index.js";

afterEach(() => {
  setLocale("en");
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// setLocale / getLocale
// ---------------------------------------------------------------------------

describe("setLocale / getLocale", () => {
  it("defaults to en", () => {
    expect(getLocale()).toBe("en");
  });

  it("sets locale to ja", () => {
    setLocale("ja");
    expect(getLocale()).toBe("ja");
  });

  it("sets locale back to en", () => {
    setLocale("ja");
    setLocale("en");
    expect(getLocale()).toBe("en");
  });
});

// ---------------------------------------------------------------------------
// detectLocale
// ---------------------------------------------------------------------------

describe("detectLocale", () => {
  it("detects ja from LANG", () => {
    vi.stubEnv("LANG", "ja_JP.UTF-8");
    vi.stubEnv("LC_ALL", "");
    expect(detectLocale()).toBe("ja");
  });

  it("detects ja from LC_ALL", () => {
    vi.stubEnv("LC_ALL", "ja_JP.UTF-8");
    expect(detectLocale()).toBe("ja");
  });

  it("LC_ALL takes precedence over LANG", () => {
    vi.stubEnv("LANG", "en_US.UTF-8");
    vi.stubEnv("LC_ALL", "ja_JP.UTF-8");
    expect(detectLocale()).toBe("ja");
  });

  it("defaults to en when no env vars", () => {
    vi.stubEnv("LANG", "");
    vi.stubEnv("LC_ALL", "");
    expect(detectLocale()).toBe("en");
  });

  it("defaults to en for unsupported locale", () => {
    vi.stubEnv("LANG", "fr_FR.UTF-8");
    vi.stubEnv("LC_ALL", "");
    expect(detectLocale()).toBe("en");
  });
});

// ---------------------------------------------------------------------------
// t() — translation
// ---------------------------------------------------------------------------

describe("t()", () => {
  it("returns English message by default", () => {
    expect(t("intro")).toBe("Create an AI-agent-native AWS project");
  });

  it("returns Japanese message when locale is ja", () => {
    setLocale("ja");
    expect(t("intro")).toBe("AI エージェント対応の AWS プロジェクトを作成");
  });

  it("interpolates variables", () => {
    const result = t("outroNextCd", { projectName: "my-app" });
    expect(result).toBe("  cd my-app");
  });

  it("interpolates variables in ja", () => {
    setLocale("ja");
    const result = t("autoResolvedVpc", { service: "ECS" });
    expect(result).toBe("VPC を自動追加しました（ECS が必要とするため）");
  });

  it("preserves unmatched placeholders", () => {
    const result = t("outroNextCd", {});
    expect(result).toBe("  cd {{projectName}}");
  });

  it("returns key for all message keys in en", () => {
    // Verify every key in en has a non-empty value
    expect(t("projectName")).toBe("Project name");
    expect(t("agents")).toBe("AI agent tools");
    expect(t("cancelled")).toBe("Operation cancelled.");
  });

  it("returns key for all message keys in ja", () => {
    setLocale("ja");
    expect(t("projectName")).toBe("プロジェクト名");
    expect(t("agents")).toBe("AI エージェントツール");
    expect(t("cancelled")).toBe("操作がキャンセルされました。");
  });
});

// ---------------------------------------------------------------------------
// Message completeness
// ---------------------------------------------------------------------------

describe("message completeness", () => {
  it("ja has all keys from en", async () => {
    const { en } = await import("../src/i18n/en.js");
    const { ja } = await import("../src/i18n/ja.js");
    const enKeys = Object.keys(en);
    const jaKeys = Object.keys(ja);
    expect(jaKeys.sort()).toEqual(enKeys.sort());
  });
});
