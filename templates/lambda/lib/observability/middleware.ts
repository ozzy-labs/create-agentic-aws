import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { logMetrics } from "@aws-lambda-powertools/metrics/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import middy from "@middy/core";
import type { Handler } from "aws-lambda";
import { logger, metrics, tracer } from "./index.js";

/**
 * Wraps a Lambda handler with Powertools middleware for
 * structured logging, metrics, and X-Ray tracing.
 */
export function withObservability(handler: Handler): middy.MiddyfiedHandler {
  return middy(handler)
    .use(injectLambdaContext(logger))
    .use(logMetrics(metrics))
    .use(captureLambdaHandler(tracer));
}
