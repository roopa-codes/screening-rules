import { DeleteMessageCommand, Message, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventHandlerService } from './event-handler.service';
import { parseEvent } from './event.types';

/**
 * Long-polls SQS. A message is deleted only after it was handled successfully;
 * otherwise it becomes visible again and is retried (configure a DLQ on the queue).
 * Handling is idempotent, so redelivery is safe.
 */
@Injectable()
export class SqsConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SqsConsumer.name);
  private client?: SQSClient;
  private queueUrl?: string;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly handler: EventHandlerService,
  ) {}

  onApplicationBootstrap() {
    this.queueUrl = this.config.get<string>('SQS_QUEUE_URL') || undefined;
    if (!this.queueUrl) {
      this.logger.warn('SQS_QUEUE_URL not set: SQS consumer disabled (use POST /events)');
      return;
    }
    this.client = new SQSClient({ region: this.config.get<string>('AWS_REGION') });
    this.running = true;
    void this.poll();
    this.logger.log(`Polling ${this.queueUrl}`);
  }

  onApplicationShutdown() {
    this.running = false;
  }

  private async poll() {
    while (this.running) {
      try {
        const res = await this.client!.send(
          new ReceiveMessageCommand({ QueueUrl: this.queueUrl, MaxNumberOfMessages: 10, WaitTimeSeconds: 20 }),
        );
        for (const msg of res.Messages ?? []) await this.process(msg);
      } catch (err) {
        this.logger.error('SQS receive failed', err as Error);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  private async process(msg: Message) {
    try {
      await this.handler.handle(parseEvent(unwrapSns(msg.Body ?? '')));
      await this.client!.send(new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: msg.ReceiptHandle }));
    } catch (err) {
      this.logger.error(`Failed to process message ${msg.MessageId}`, err as Error);
    }
  }
}

/** Accept both raw SQS messages and SNS-to-SQS envelopes. */
function unwrapSns(body: string): unknown {
  const parsed = JSON.parse(body);
  return parsed?.Type === 'Notification' && typeof parsed.Message === 'string' ? JSON.parse(parsed.Message) : parsed;
}