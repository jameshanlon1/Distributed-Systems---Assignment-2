import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";

import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class EDAAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const imagesBucket = new s3.Bucket(this, "images", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });


  // Integration infrastructure
  const deadLetterQueue = new sqs.Queue(this, 'ImageDLQ');
  const imageProcessQueue = new sqs.Queue(this, "img-created-queue", {
    receiveMessageWaitTime: cdk.Duration.seconds(10),
    
  });


  const topic = new sns.Topic(this, "ImageTopic", {
    displayName: "Image topic",
  }); 


  const mailerQ = new sqs.Queue(this, "mailer-queue", {
    receiveMessageWaitTime: cdk.Duration.seconds(10),
  });
  

// DynamoDB Table
  const imageTable = new dynamodb.Table(this, 'ImageTable', {
    partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    removalPolicy: cdk.RemovalPolicy.DESTROY
  });

  // Lambda functions

  const logImageFn = new lambdanode.NodejsFunction(
    this,
    "LogImageFn",
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/logImage.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
    }
  );

  const addMetadataFn = new lambdanode.NodejsFunction(
    this,
    "AddMetadataFn",
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/addMetadata.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
    }
  );

  const updateStatusFn = new lambdanode.NodejsFunction(this, "UpdateStatusFn", {
    runtime: lambda.Runtime.NODEJS_16_X,
    memorySize: 1024,
    timeout: cdk.Duration.seconds(3),
    entry: `${__dirname}/../lambdas/updateStatus.ts`,
  });

  const removeImageFn = new lambdanode.NodejsFunction(
    this,
    "RemoveImageFn",
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/removeImage.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
    }
  );

  const confirmationMailerFn = new lambdanode.NodejsFunction(
    this,
    "ConfirmationMailerFn",
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/confirmationMailer.ts.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
    }
  );


  // S3 --> SQS
  imagesBucket.addEventNotification(
    s3.EventType.OBJECT_CREATED,
    new s3n.SnsDestination(topic)  // Changed
);

topic.addSubscription(new subscriptions.SqsSubscription(imageQueue, {
  filterPolicy: {
    eventType: sns.SubscriptionFilter.stringFilter({ allowlist: ['ObjectCreated'] })
  }
}));

topic.addSubscription(new subscriptions.LambdaSubscription(addMetadataFn, {
  filterPolicy: {
    metadata_type: sns.SubscriptionFilter.stringFilter({ allowlist: ['Caption', 'Date', 'Name'] })
  }
}));

topic.addSubscription(new subscriptions.LambdaSubscription(updateStatusFn, {
  filterPolicy: {
    eventType: sns.SubscriptionFilter.stringFilter({ allowlist: ['ModeratorUpdate'] })
  }
}));


topic.addSubscription(
  new subs.SqsSubscription(imageProcessQueue)
);

newImageTopic.addSubscription(new subs.SqsSubscription(mailerQ));



 // SQS --> Lambda
  const newImageEventSource = new events.SqsEventSource(imageProcessQueue, {
    batchSize: 5,
    maxBatchingWindow: cdk.Duration.seconds(5),
  });

  logImageFn.addEventSource(newImageEventSource);



  // Permissions

  imagesBucket.grantRead(logImageFn);


  confirmationMailerFn.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:SendTemplatedEmail",
      ],
      resources: ["*"],
    })
  );


  // Output
  
  new cdk.CfnOutput(this, "bucketName", {
    value: imagesBucket.bucketName,
  });


  }
}
