import type { Handler } from "aws-lambda";
import { withObservability } from "../../lib/observability/middleware";
import { logger } from "../powertools";

const baseHandler: Handler = async (event) => {
  logger.info("Processing event", { event });

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello from Lambda!" }),
  };
};

export const handler = withObservability(baseHandler);
