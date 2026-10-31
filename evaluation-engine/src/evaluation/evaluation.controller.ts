import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { EvaluationTrigger, Outcome } from '../common/enums';
import { OverrideDto, PreviewDto } from './dto';
import { EvaluationService } from './evaluation.service';

@Controller()
export class EvaluationController {
  constructor(private readonly evaluation: EvaluationService) {}

  /** Try rules against answers without saving anything (handy for the rule editor UI). */
  @Post('evaluate/preview')
  preview(@Body() dto: PreviewDto) {
    const rules = dto.rules.map((r, i) => ({
      id: r.id ?? i + 1,
      code: r.ruleCode,
      label: r.label ?? r.questionKey,
      questionKey: r.questionKey,
      type: r.ruleTypeCode,
      params: r.params,
      onFail: r.onFail,
      onMissing: r.onMissing ?? Outcome.REVIEW,
    }));
    return this.evaluation.preview(rules, dto.answers);
  }

  @Post('applications/:id/evaluate')
  evaluate(@Param('id', ParseIntPipe) id: number) {
    return this.evaluation.evaluateApplication(id, EvaluationTrigger.MANUAL);
  }

  @Post('jobs/:id/reevaluate')
  reevaluateJob(@Param('id', ParseIntPipe) id: number) {
    return this.evaluation.reevaluateJob(id, EvaluationTrigger.MANUAL);
  }

  @Get('applications/:id/evaluation')
  status(@Param('id', ParseIntPipe) id: number) {
    return this.evaluation.getStatus(id);
  }

  @Get('applications/:id/evaluation/history')
  history(@Param('id', ParseIntPipe) id: number) {
    return this.evaluation.getHistory(id);
  }

  @Post('applications/:id/override')
  override(@Param('id', ParseIntPipe) id: number, @Body() dto: OverrideDto) {
    return this.evaluation.override(id, dto);
  }
}
