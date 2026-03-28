import type { SQSEvent, SQSRecord } from "aws-lambda";

/**
 * Process a single SQS record.
 * Implement your business logic here.
 */
async function processRecord(record: SQSRecord): Promise<void> {
  const body = JSON.parse(record.body) as unknown;
  console.log("Processing message:", JSON.stringify(body));
}

/**
 * SQS batch consumer handler.
 * Processes each record individually and reports partial failures.
 */
export const handler = async (event: SQSEvent) => {
  const failures: string[] = [];

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error("Failed to process record:", record.messageId, error);
      failures.push(record.messageId);
    }
  }

  return {
    batchItemFailures: failures.map((id) => ({ itemIdentifier: id })),
  };
};
