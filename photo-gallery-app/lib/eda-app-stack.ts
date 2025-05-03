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
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION } from '../env';

import { Construct } from "constructs";

export class EDAAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const imagesBucket = new s3.Bucket(this, "images", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });

    const deadLetterQueue = new sqs.Queue(this, 'ImageDLQ');
    const imageProcessQueue = new sqs.Queue(this, "img-created-queue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
      deadLetterQueue: {
        maxReceiveCount: 2,
        queue: deadLetterQueue,
      },
    });

    const topic = new sns.Topic(this, "ImageTopic", {
      displayName: "Image topic",
    });

    const notifyTopic = new sns.Topic(this, "NotifyTopic", {
      displayName: "Notify Photographers",
    });

    const imageTable = new dynamodb.Table(this, 'ImageTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const logImageFn = new lambdanode.NodejsFunction(this, "LogImageFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/logImages.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
    });
    logImageFn.addEnvironment("TABLE_NAME", imageTable.tableName);
    imageTable.grantWriteData(logImageFn);

    const addMetadataFn = new lambdanode.NodejsFunction(this, "AddMetadataFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/addMetadata.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
    });
    addMetadataFn.addEnvironment("TABLE_NAME", imageTable.tableName);
    imageTable.grantWriteData(addMetadataFn);

    const updateStatusFn = new lambdanode.NodejsFunction(this, "UpdateStatusFn", {
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      entry: `${__dirname}/../lambdas/updateStatus.ts`,
    });
    updateStatusFn.addEnvironment("TABLE_NAME", imageTable.tableName);
    updateStatusFn.addEnvironment("STATUS_NOTIFY_TOPIC_ARN", notifyTopic.topicArn);
    imageTable.grantWriteData(updateStatusFn);
    notifyTopic.grantPublish(updateStatusFn);

    const removeImageFn = new lambdanode.NodejsFunction(this, "RemoveImageFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/removeImage.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
    });
    removeImageFn.addEnvironment("TABLE_NAME", imageTable.tableName);
    imageTable.grantWriteData(removeImageFn);

    const confirmationMailerFn = new lambdanode.NodejsFunction(this, "ConfirmationMailerFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/confirmationMailer.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
    });
    confirmationMailerFn.addEnvironment("SES_EMAIL_FROM", SES_EMAIL_FROM);
    confirmationMailerFn.addEnvironment("SES_EMAIL_TO", SES_EMAIL_TO);
    confirmationMailerFn.addEnvironment("SES_REGION", SES_REGION);
    confirmationMailerFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["ses:SendEmail", "ses:SendRawEmail", "ses:SendTemplatedEmail"],
      resources: ["*"]
    }));

    notifyTopic.addSubscription(new subs.LambdaSubscription(confirmationMailerFn));

    imagesBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SnsDestination(topic)
    );

    topic.addSubscription(new subs.SqsSubscription(imageProcessQueue, {
      filterPolicy: {
        eventType: sns.SubscriptionFilter.stringFilter({ allowlist: ['ObjectCreated'] })
      }
    }));

    topic.addSubscription(new subs.LambdaSubscription(addMetadataFn, {
      filterPolicy: {
        metadata_type: sns.SubscriptionFilter.stringFilter({ allowlist: ['Caption', 'Date', 'Name'] })
      }
    }));

    topic.addSubscription(new subs.LambdaSubscription(updateStatusFn, {
      filterPolicy: {
        eventType: sns.SubscriptionFilter.stringFilter({ allowlist: ['ModeratorUpdate'] })
      }
    }));

    logImageFn.addEventSource(new events.SqsEventSource(imageProcessQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    }));

    imagesBucket.grantRead(logImageFn);

    new cdk.CfnOutput(this, "bucketName", {
      value: imagesBucket.bucketName,
    });
  }
}
