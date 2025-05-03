import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

export const handler = async (event: any) => {
  const dynamodb = new DynamoDBClient({});
  const tableName = process.env.TABLE_NAME;

  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    const metadataType = record.Sns.MessageAttributes.metadata_type.StringValue;
    const imageId = message.id;
    const value = message.value;

    if (!['Caption', 'Date', 'Name'].includes(metadataType)) {
      console.log(`Invalid metadata type: ${metadataType}`);
      continue;
    }

    const updateParams = {
      TableName: tableName,
      Key: {
        id: { S: imageId },
      },
      UpdateExpression: `SET #field = :value`,
      ExpressionAttributeNames: {
        '#field': metadataType,
      },
      ExpressionAttributeValues: {
        ':value': { S: value },
      },
    };

    await dynamodb.send(new UpdateItemCommand(updateParams));
  }

  return {
    statusCode: 200,
    body: 'Metadata processed.'
  };
};
