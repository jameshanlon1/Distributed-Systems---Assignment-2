import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";


export const handler = async (event: any) => {
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
        Key: { id },
        UpdateExpression: 'SET #status = :status, #reason = :reason, #date = :date',
        ExpressionAttributeNames: {
          '#status': 'Status',
          '#reason': 'Reason',
          '#date': 'ReviewedDate'
        },
        ExpressionAttributeValues: {
          ':status': update.status,
          ':reason': update.reason,
          ':date': date
        },
      };
  
      await dynamodb.send(new UpdateItemCommand(updateParams));
    }
  
    return {
      statusCode: 200,
      body: 'Status updates processed.'
    };
  };