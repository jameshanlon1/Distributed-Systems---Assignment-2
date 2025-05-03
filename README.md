## Distributed Systems - Event-Driven Architecture

__Name:__ James Hanlon

__Demo__: [Add your YouTube demo URL here]

This repository contains the implementation of a skeleton design for an application that manages a photo gallery, illustrated below. The app uses an event-driven architecture and is deployed on the AWS platform using the CDK framework for infrastructure provisioning.

![Architecture Diagram](./photo-gallery-app/images/arch.png)

---

### Code Status

__Feature:__

+ Photographer:
  + Log new Images – Completed and Tested
  + Metadata updating – Completed and Tested
  + Invalid image removal – Attempted  
    The DLQ and removal Lambda are implemented, but invalid files are not triggering the LogImage Lambda as expected.
  + Status Update Mailer – Attempted  
    Mailer Lambda and SES config are in place, but the Lambda is not triggering; no logs seen in CloudWatch.

+ Moderator:
  + Status updating – Completed and Tested

__Filtering:__

SNS filter policies are correctly applied to:
- Only process `.jpeg` or `.png` files
- Isolate metadata updates by `metadata_type`
- Trigger status updates only on `eventType = ModeratorUpdate`

---

### Notes

- AWS CDK is used to provision all infrastructure as code
- The system leverages S3, SNS, SQS, Lambda, DynamoDB, and SES
- SNS filtering ensures that each subscriber receives only the appropriate events
- Remaining tasks include debugging invalid file detection and confirming SES mailer delivery
