import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createTerraformPreset } from "../../src/presets/terraform.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "terraform",
    compute: [],
    data: [],
    integration: [],
    networking: [],
    security: [],
    observability: [],
    languages: [],
    ...overrides,
  };
}

function makeRegistry(...presets: Preset[]): Map<PresetName, Preset> {
  return new Map(presets.map((p) => [p.name, p]));
}

describe("terraform preset", () => {
  const terraform = createTerraformPreset();

  it("has name 'terraform'", () => {
    expect(terraform.name).toBe("terraform");
  });

  // Owned files
  describe("owned files", () => {
    const ownedFiles = [
      "infra/main.tf",
      "infra/variables.tf",
      "infra/outputs.tf",
      "infra/terraform.tfvars.example",
      ".tflint.hcl",
    ];

    for (const file of ownedFiles) {
      it(`includes ${file}`, () => {
        expect(terraform.files[file]).toBeDefined();
        expect(terraform.files[file].length).toBeGreaterThan(0);
      });
    }
  });

  // Merge contributions
  describe("merge contributions", () => {
    it("adds .terraform to .gitignore", () => {
      const gitignore = terraform.merge[".gitignore"] as string;
      expect(gitignore).toContain("infra/.terraform/");
      expect(gitignore).toContain("*.tfstate");
    });

    it("adds terraform and tflint to mise tools", () => {
      const mise = terraform.merge[".mise.toml"] as Record<string, unknown>;
      const tools = mise.tools as Record<string, string>;
      expect(tools.terraform).toBeDefined();
      expect(tools.tflint).toBeDefined();
    });

    it("adds terraform-fmt to lefthook pre-commit", () => {
      const lefthook = terraform.merge["lefthook.yaml"] as Record<string, unknown>;
      const preCommit = lefthook["pre-commit"] as Record<string, unknown>;
      const commands = preCommit.commands as Record<string, unknown>;
      expect(commands["terraform-fmt"]).toBeDefined();
      expect(commands.tflint).toBeDefined();
    });

    it("adds terraform-validate to lefthook pre-push", () => {
      const lefthook = terraform.merge["lefthook.yaml"] as Record<string, unknown>;
      const prePush = lefthook["pre-push"] as Record<string, unknown>;
      const commands = prePush.commands as Record<string, unknown>;
      expect(commands["terraform-validate"]).toBeDefined();
    });

    it("adds Terraform steps to CI workflow", () => {
      const ci = terraform.merge[".github/workflows/ci.yaml"] as Record<string, unknown>;
      const jobs = ci.jobs as Record<string, unknown>;
      const ciJob = jobs.ci as Record<string, unknown>;
      const steps = ciJob.steps as Array<{ name: string }>;
      expect(steps.some((s) => s.name === "Terraform validate")).toBe(true);
      expect(steps.some((s) => s.name === "Lint (tflint)")).toBe(true);
    });

    it("adds HashiCorp Terraform to VSCode extensions", () => {
      const ext = terraform.merge[".vscode/extensions.json"] as Record<string, unknown>;
      expect(ext.recommendations).toContain("hashicorp.terraform");
    });

    it("adds HashiCorp Terraform to devcontainer", () => {
      const dc = terraform.merge[".devcontainer/devcontainer.json"] as Record<string, unknown>;
      const customizations = dc.customizations as Record<string, unknown>;
      const vscode = customizations.vscode as Record<string, unknown>;
      expect(vscode.extensions).toContain("hashicorp.terraform");
    });
  });

  // Owned file content
  describe("file content", () => {
    it("main.tf has AWS provider with default tags", () => {
      expect(terraform.files["infra/main.tf"]).toContain("hashicorp/aws");
      expect(terraform.files["infra/main.tf"]).toContain("default_tags");
    });

    it("variables.tf has project_name and aws_region", () => {
      expect(terraform.files["infra/variables.tf"]).toContain("project_name");
      expect(terraform.files["infra/variables.tf"]).toContain("aws_region");
    });

    it("outputs.tf has aws_region output", () => {
      expect(terraform.files["infra/outputs.tf"]).toContain("aws_region");
    });

    it(".tflint.hcl has AWS plugin", () => {
      expect(terraform.files[".tflint.hcl"]).toContain("tflint-ruleset-aws");
    });
  });

  // Integration with generator
  describe("integration with generator", () => {
    const registry = makeRegistry(createBasePreset(), terraform);

    it("generates infra directory structure", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/main.tf")).toBe(true);
      expect(result.hasFile("infra/variables.tf")).toBe(true);
      expect(result.hasFile("infra/outputs.tf")).toBe(true);
      expect(result.hasFile("infra/terraform.tfvars.example")).toBe(true);
      expect(result.hasFile(".tflint.hcl")).toBe(true);
    });

    it("substitutes projectName in variables.tf", () => {
      const result = generate(makeAnswers({ projectName: "test-app" }), registry);
      const vars = result.readText("infra/variables.tf");
      expect(vars).toContain("test-app");
      expect(vars).not.toContain("{{projectName}}");
    });

    it("substitutes projectName in terraform.tfvars.example", () => {
      const result = generate(makeAnswers({ projectName: "test-app" }), registry);
      const tfvars = result.readText("infra/terraform.tfvars.example");
      expect(tfvars).toContain("test-app");
    });

    it("merges .terraform into .gitignore", () => {
      const result = generate(makeAnswers(), registry);
      const gitignore = result.readText(".gitignore");
      expect(gitignore).toContain("infra/.terraform/");
    });

    it("merges Terraform extension into VSCode", () => {
      const result = generate(makeAnswers(), registry);
      const ext = result.readJson<{ recommendations: string[] }>(".vscode/extensions.json");
      expect(ext.recommendations).toContain("hashicorp.terraform");
    });
  });
});
