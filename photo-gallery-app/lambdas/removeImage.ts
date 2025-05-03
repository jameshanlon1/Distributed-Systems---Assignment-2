export const handler = async (event: any) => {
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3();
    const bucketName = process.env.BUCKET_NAME;
  
    for (const record of event.Records) {
      const body = JSON.parse(record.body);
      const s3Info = body.Records?.[0]?.s3;
      const key = s3Info?.object?.key;
  
      if (key) {
        await s3.deleteObject({ Bucket: bucketName, Key: key }).promise();
        console.log(`Deleted invalid image: ${key}`);
      }
    }
  
    return {
      statusCode: 200,
      body: 'DLQ cleanup done.'
    };
  };