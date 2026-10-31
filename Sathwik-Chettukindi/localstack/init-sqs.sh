#!/bin/bash
set -euo pipefail

DLQ_URL=$(awslocal sqs create-queue \
  --queue-name job-events-dlq.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=false \
  --query QueueUrl --output text)

DLQ_ARN=$(awslocal sqs get-queue-attributes \
  --queue-url "$DLQ_URL" \
  --attribute-names QueueArn \
  --query Attributes.QueueArn --output text)

cat > /tmp/main-queue-attrs.json <<JSON
{
  "FifoQueue": "true",
  "ContentBasedDeduplication": "false",
  "RedrivePolicy": "{\"deadLetterTargetArn\":\"${DLQ_ARN}\",\"maxReceiveCount\":\"3\"}"
}
JSON

awslocal sqs create-queue \
  --queue-name job-events.fifo \
  --attributes file:///tmp/main-queue-attrs.json

echo "SQS ready: job-events.fifo (DLQ ${DLQ_ARN}, maxReceiveCount=3)"
