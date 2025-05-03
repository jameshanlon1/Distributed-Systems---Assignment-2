export const handler = async (event: any) => {
    const AWS = require('aws-sdk');
    const dynamodb = new AWS.DynamoDB.DocumentClient();
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
        Key: { id: imageId },
        UpdateExpression: `SET #field = :value` ,
        ExpressionAttributeNames: {
          '#field': metadataType,
        },
        ExpressionAttributeValues: {
          ':value': value,
        },
      };
  
      await dynamodb.update(updateParams).promise();
    }
  
    return {
      statusCode: 200,
      body: 'Metadata processed.'
    };
  };