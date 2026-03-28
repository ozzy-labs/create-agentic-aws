import type { Preset, PresetName } from "../types.js";
import { createAmazonQPreset } from "./amazon-q.js";
import { createBasePreset } from "./base.js";
import { createCdkPreset } from "./cdk.js";
import { createClaudeCodePreset } from "./claude-code.js";
import { createCopilotPreset } from "./copilot.js";
import { createPythonPreset } from "./python.js";
import { createTypescriptPreset } from "./typescript.js";

/** Build the preset registry with all available presets. */
export function createRegistry(): Map<PresetName, Preset> {
  const presets: Preset[] = [
    createBasePreset(),
    createTypescriptPreset(),
    createPythonPreset(),
    createAmazonQPreset(),
    createClaudeCodePreset(),
    createCopilotPreset(),
    createCdkPreset(),
    // Service presets will be added in M3-M6
  ];

  return new Map(presets.map((p) => [p.name, p]));
}
