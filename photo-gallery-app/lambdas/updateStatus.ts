import { SNSHandler } from "aws-lambda";
import {
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

export const handler: SNSHandler = async (event) => {
  const dynamodb = new DynamoDBClient({});
  const tableName = process.env.TABLE_NAME;

  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    const { id, date, update } = message;

    if (!['Pass', 'Reject'].includes(update.status)) {
      console.log(`Invalid status: ${update.status}`);
      continue;
    }

    const updateParams = {
      TableName: tableName,
      Key: { id: { S: id } }, // ✅ correct structure
      UpdateExpression: 'SET #status = :status, #reason = :reason, #date = :date',
      ExpressionAttributeNames: {
        '#status': 'Status',
        '#reason': 'Reason',
        '#date': 'ReviewedDate'
      },
      ExpressionAttributeValues: {
        ':status': { S: update.status },
        ':reason': { S: update.reason },
        ':date': { S: date }
      },
    };

    await dynamodb.send(new UpdateItemCommand(updateParams));
    console.log(`Updated image "${id}" with status "${update.status}"`);
  }

  return {
    statusCode: 200,
    body: 'Status updates processed.'
  };
};
