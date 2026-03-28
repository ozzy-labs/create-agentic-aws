import type { Handler } from "aws-lambda";

interface ActionGroupEvent {
  readonly messageVersion: string;
  readonly agent: {
    readonly name: string;
    readonly id: string;
    readonly alias: string;
    readonly version: string;
  };
  readonly inputText: string;
  readonly sessionId: string;
  readonly actionGroup: string;
  readonly apiPath: string;
  readonly httpMethod: string;
  readonly parameters?: readonly {
    readonly name: string;
    readonly type: string;
    readonly value: string;
  }[];
  readonly requestBody?: {
    readonly content: Record<string, unknown>;
  };
  readonly sessionAttributes: Record<string, string>;
  readonly promptSessionAttributes: Record<string, string>;
}

interface ActionGroupResponse {
  readonly messageVersion: string;
  readonly response: {
    readonly actionGroup: string;
    readonly apiPath: string;
    readonly httpMethod: string;
    readonly httpStatusCode: number;
    readonly responseBody: {
      readonly "application/json": {
        readonly body: string;
      };
    };
  };
  readonly sessionAttributes: Record<string, string>;
  readonly promptSessionAttributes: Record<string, string>;
}

export const handler: Handler<ActionGroupEvent, ActionGroupResponse> = async (event) => {
  const { actionGroup, apiPath, httpMethod, parameters } = event;

  console.log("Action Group invoked", { actionGroup, apiPath, httpMethod });

  // NEXT: Implement your action group logic based on apiPath and httpMethod
  const result = {
    message: `Action ${apiPath} executed successfully`,
    parameters: parameters ?? [],
  };

  return {
    messageVersion: event.messageVersion,
    response: {
      actionGroup: event.actionGroup,
      apiPath: event.apiPath,
      httpMethod: event.httpMethod,
      httpStatusCode: 200,
      responseBody: {
        "application/json": {
          body: JSON.stringify(result),
        },
      },
    },
    sessionAttributes: event.sessionAttributes,
    promptSessionAttributes: event.promptSessionAttributes,
  };
};
