import { ValueTransformer } from 'typeorm';

/** node-postgres returns bigint as string; ids here fit safely in a JS number. */
export const bigint: ValueTransformer = {
  to: (v: number | null | undefined) => v,
  from: (v: string | null) => (v === null || v === undefined ? v : Number(v)),
};
