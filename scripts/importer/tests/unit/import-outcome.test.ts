import { describe, expect, it } from 'vitest';

import {
  IMPORT_EXIT_CLEAN,
  IMPORT_EXIT_ROW_ERRORS,
  IMPORT_EXIT_STEP_FAILED,
  importExitCode,
  isFailedStep,
  thrownStepResult,
} from '../../src/utils/import-outcome.js';

const step = (imported: number, skipped: number, errors: string[] = []) => ({
  imported,
  skipped,
  errors,
});

describe('isFailedStep', () => {
  it('is false for a step that ran clean', () => {
    expect(isFailedStep(step(10, 2))).toBe(false);
  });

  it('is false for a step with some row errors', () => {
    expect(isFailedStep(step(10, 0, ['bad row']))).toBe(false);
    expect(isFailedStep(step(0, 5, ['bad row']))).toBe(false);
  });

  it('is true for a step that threw', () => {
    expect(isFailedStep(thrownStepResult('connection lost'))).toBe(true);
  });

  it('is true for a step that processed nothing and reported errors', () => {
    expect(isFailedStep(step(0, 0, ['Query timed out']))).toBe(true);
  });

  it('is false for a step with nothing to process and no errors', () => {
    expect(isFailedStep(step(0, 0))).toBe(false);
  });
});

describe('importExitCode', () => {
  it('is 0 for a clean run', () => {
    expect(importExitCode([step(10, 2), step(3, 0)])).toBe(IMPORT_EXIT_CLEAN);
    expect(IMPORT_EXIT_CLEAN).toBe(0);
  });

  it('is 0 for a run with no steps', () => {
    expect(importExitCode([])).toBe(IMPORT_EXIT_CLEAN);
  });

  it('is 1 when only rows failed', () => {
    expect(importExitCode([step(10, 0, ['bad row']), step(3, 1)])).toBe(IMPORT_EXIT_ROW_ERRORS);
    expect(IMPORT_EXIT_ROW_ERRORS).toBe(1);
  });

  it('is 2 when a step threw', () => {
    expect(importExitCode([step(10, 0, ['bad row']), thrownStepResult('boom')])).toBe(
      IMPORT_EXIT_STEP_FAILED
    );
    expect(IMPORT_EXIT_STEP_FAILED).toBe(2);
  });

  it('is 2 when a step processed nothing and reported errors', () => {
    expect(importExitCode([step(0, 0, ['Query timed out']), step(10, 0)])).toBe(
      IMPORT_EXIT_STEP_FAILED
    );
  });

  it('is 0 when a step had nothing to process and no errors', () => {
    expect(importExitCode([step(0, 0), step(10, 0)])).toBe(IMPORT_EXIT_CLEAN);
  });

  it('accepts the values of a results map', () => {
    const results = new Map([
      ['a', step(10, 0)],
      ['b', step(0, 0, ['Query timed out'])],
    ]);
    expect(importExitCode(results.values())).toBe(IMPORT_EXIT_STEP_FAILED);
  });
});
