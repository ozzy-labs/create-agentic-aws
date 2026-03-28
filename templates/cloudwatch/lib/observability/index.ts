import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import { Tracer } from "@aws-lambda-powertools/tracer";

export const logger = new Logger({ serviceName: "{{projectName}}" });
export const tracer = new Tracer({ serviceName: "{{projectName}}" });
export const metrics = new Metrics({
  namespace: "{{projectName}}",
  serviceName: "{{projectName}}",
});

export { MetricUnit };
