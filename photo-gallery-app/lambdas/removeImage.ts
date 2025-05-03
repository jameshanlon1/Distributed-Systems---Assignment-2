import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({});


export const handler = async (event: any) => {
    const dynamodb = new DynamoDBClient({});
    const bucketName = process.env.BUCKET_NAME;
  
    for (const record of event.Records) {
      const body = JSON.parse(record.body);
      const s3Info = body.Records?.[0]?.s3;
      const key = s3Info?.object?.key;
  
      if (key) {
        await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
        console.log(`Deleted invalid image: ${key}`);
      }
    }
  
    return {
      statusCode: 200,
      body: 'DLQ cleanup done.'
    };
  };