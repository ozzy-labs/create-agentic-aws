import type { Handler } from "aws-lambda";
import { logger } from "../powertools";

export const handler: Handler = async (event) => {
  logger.info("Processing event", { event });

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello from Lambda!" }),
  };
};
