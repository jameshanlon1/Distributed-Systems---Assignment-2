export const handler = async (event: any) => {
    const AWS = require('aws-sdk');
    const dynamodb = new AWS.DynamoDB.DocumentClient();
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
  
      await dynamodb.update(updateParams).promise();
    }
  
    return {
      statusCode: 200,
      body: 'Status updates processed.'
    };
  };