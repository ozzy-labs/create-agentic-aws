import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import type { AppEvent } from "./events";

const client = new EventBridgeClient({});

const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME;
if (!EVENT_BUS_NAME) throw new Error("EVENT_BUS_NAME environment variable is required");

export async function publishEvent<T>(event: AppEvent<T>): Promise<void> {
  try {
    const result = await client.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: EVENT_BUS_NAME,
            Source: event.source,
            DetailType: event.detailType,
            Detail: JSON.stringify(event.detail),
          },
        ],
      }),
    );

    if (result.FailedEntryCount && result.FailedEntryCount > 0) {
      const failed = result.Entries?.filter((e) => e.ErrorCode);
      console.error("Failed to publish events:", JSON.stringify(failed));
      throw new Error(`Failed to publish ${result.FailedEntryCount} event(s)`);
    }
  } catch (err) {
    console.error("EventBridge publish error:", err);
    throw err;
  }
}
