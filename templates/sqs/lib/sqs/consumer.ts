import type { SQSEvent, SQSRecord } from "aws-lambda";

/**
 * Process a single SQS record.
 * Implement your business logic here.
 */
async function processRecord(record: SQSRecord): Promise<void> {
  const body = JSON.parse(record.body) as unknown;
  console.info(JSON.stringify({ message: "Processing SQS message", messageId: record.messageId, body }));
}

/**
 * SQS batch consumer handler.
 * Processes each record individually and reports partial failures.
 *
 * NEXT: If using CloudWatch preset, wrap this handler with
 * `withObservability` from `lib/observability/middleware` for
 * structured logging, metrics, and X-Ray tracing.
 */
export const handler = async (event: SQSEvent) => {
  console.info(JSON.stringify({ message: "SQS batch received", recordCount: event.Records.length }));
  const failures: string[] = [];

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error(JSON.stringify({ message: "Failed to process record", messageId: record.messageId, error: String(error) }));
      failures.push(record.messageId);
    }
  }

  return {
    batchItemFailures: failures.map((id) => ({ itemIdentifier: id })),
  };
};
