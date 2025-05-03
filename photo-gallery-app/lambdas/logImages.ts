/* eslint-disable import/extensions, import/no-absolute-path */
import { SQSHandler } from "aws-lambda";
import {
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));
  const ddb = new DynamoDBClient({});

  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);
    const snsMessage = JSON.parse(recordBody.Message);

    if (snsMessage.Records) {
      for (const messageRecord of snsMessage.Records) {
        const s3e = messageRecord.s3;
        const srcBucket = s3e.bucket.name;
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));

        const validExtensions = [".jpeg", ".png"];
        const extension = srcKey.slice(srcKey.lastIndexOf(".")).toLowerCase();

        if (!validExtensions.includes(extension)) {
          console.log(`Invalid file extension: ${extension}`);
          throw new Error(`Invalid file extension: ${extension}`);
        }

        console.log(`Logging valid image: ${srcKey}`);
        await ddb.send(
          new PutItemCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
              id: { S: srcKey },
            },
          })
        );
      }
    }
  }
};
