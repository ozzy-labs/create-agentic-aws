import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import type { AppEvent } from "./events";

const client = new EventBridgeClient({});

const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME ?? "default";

export async function publishEvent<T>(event: AppEvent<T>): Promise<void> {
  await client.send(
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
}
