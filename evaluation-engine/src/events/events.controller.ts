import { Body, Controller, Post } from '@nestjs/common';
import { EventHandlerService } from './event-handler.service';
import { parseEvent } from './event.types';

/** Same handling as the SQS consumer; use it locally or for demos without AWS. */
@Controller('events')
export class EventsController {
  constructor(private readonly handler: EventHandlerService) {}

  @Post()
  receive(@Body() body: unknown) {
    return this.handler.handle(parseEvent(body));
  }
}
