import { Module } from '@nestjs/common';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { EventHandlerService } from './event-handler.service';
import { EventsController } from './events.controller';
import { SqsConsumer } from './sqs.consumer';

@Module({
  imports: [EvaluationModule],
  controllers: [EventsController],
  providers: [EventHandlerService, SqsConsumer],
})
export class EventsModule {}
