import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./client";

const TABLE_NAME = process.env.TABLE_NAME ?? "";

export interface Item {
  pk: string;
  sk: string;
  [key: string]: unknown;
}

export async function getItem(pk: string, sk: string): Promise<Item | undefined> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk, sk },
    }),
  );
  return result.Item as Item | undefined;
}

export async function putItem(item: Item): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    }),
  );
}

export async function queryItems(pk: string): Promise<Item[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": pk },
    }),
  );
  return (result.Items ?? []) as Item[];
}
