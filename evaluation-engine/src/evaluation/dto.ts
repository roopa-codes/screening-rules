import { Type } from 'class-transformer';
import {
  IsArray, IsEnum, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested,
} from 'class-validator';
import { Outcome } from '../common/enums';

export class OverrideDto {
  @IsEnum(Outcome)
  toOutcome: Outcome;

  @IsString()
  @IsNotEmpty()
  comment: string;

  // TODO: take from the JWT once the auth service guard is wired in.
  @IsInt()
  overriddenBy: number;
}

export class PreviewRuleDto {
  @IsOptional() @IsInt() id?: number;
  @IsString() ruleCode: string;
  @IsString() questionKey: string;
  @IsOptional() @IsString() label?: string;
  @IsString() ruleTypeCode: string;
  @IsObject() params: Record<string, unknown>;
  @IsIn([Outcome.FAIL, Outcome.REVIEW]) onFail: Outcome;
  @IsOptional() @IsIn([Outcome.FAIL, Outcome.REVIEW]) onMissing?: Outcome;
}

export class PreviewDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewRuleDto)
  rules: PreviewRuleDto[];

  /** { question_key: value } */
  @IsObject()
  answers: Record<string, unknown>;
}
