import type { KinesisStreamEvent, KinesisStreamRecord } from "aws-lambda";

/**
 * Process a single Kinesis record.
 * Implement your business logic here.
 */
async function processRecord(record: KinesisStreamRecord): Promise<void> {
  const payload = Buffer.from(record.kinesis.data, "base64").toString("utf-8");
  const data = JSON.parse(payload) as unknown;
  console.info(
    JSON.stringify({
      message: "Processing Kinesis record",
      sequenceNumber: record.kinesis.sequenceNumber,
      partitionKey: record.kinesis.partitionKey,
      data,
    }),
  );
}

/**
 * Kinesis stream consumer handler.
 * Processes each record individually and reports partial failures.
 */
export const handler = async (event: KinesisStreamEvent) => {
  console.info(
    JSON.stringify({
      message: "Kinesis batch received",
      recordCount: event.Records.length,
    }),
  );
  const failures: string[] = [];

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "Failed to process record",
          sequenceNumber: record.kinesis.sequenceNumber,
          error: String(error),
        }),
      );
      failures.push(record.kinesis.sequenceNumber);
    }
  }

  return {
    batchItemFailures: failures.map((id) => ({ itemIdentifier: id })),
  };
};
