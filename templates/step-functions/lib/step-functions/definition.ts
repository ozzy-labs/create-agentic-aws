/**
 * Step Functions state machine definition (ASL).
 * Customize the definition for your workflow.
 */

export interface StepFunctionDefinition {
  Comment: string;
  StartAt: string;
  States: Record<string, unknown>;
}

export const WORKFLOW_DEFINITION: StepFunctionDefinition = {
  Comment: "{{projectName}} workflow",
  StartAt: "ProcessInput",
  States: {
    ProcessInput: {
      Type: "Pass",
      Result: { status: "processed" },
      Next: "CheckResult",
    },
    CheckResult: {
      Type: "Choice",
      Choices: [
        {
          Variable: "$.status",
          StringEquals: "processed",
          Next: "Success",
        },
      ],
      Default: "Fail",
    },
    Success: {
      Type: "Succeed",
    },
    Fail: {
      Type: "Fail",
      Error: "WorkflowFailed",
      Cause: "Processing failed",
    },
  },
};
