import type { ImportResult } from '../core/types.js';

/**
 * Exit codes of the `import` command. The import tool's `stage` mode reads
 * them (scripts/import-tool/entrypoint.sh): row errors are expected on the
 * legacy dataset and must not stop it, a failed step must.
 */
export const IMPORT_EXIT_CLEAN = 0;
export const IMPORT_EXIT_ROW_ERRORS = 1;
export const IMPORT_EXIT_STEP_FAILED = 2;

export type ImportExitCode =
  typeof IMPORT_EXIT_CLEAN | typeof IMPORT_EXIT_ROW_ERRORS | typeof IMPORT_EXIT_STEP_FAILED;

type StepCounts = Pick<ImportResult, 'imported' | 'skipped' | 'errors'>;

/**
 * The result recorded for a step that threw instead of returning one.
 */
export function thrownStepResult(message: string): ImportResult {
  return {
    success: false,
    imported: 0,
    skipped: 0,
    errors: [message],
    warnings: [],
  };
}

/**
 * True when a step failed outright rather than on some of its rows: it threw
 * (see thrownStepResult), or it processed nothing yet reported errors, which
 * is how a step whose source query failed ends. A step with nothing to
 * process and no errors has not failed.
 */
export function isFailedStep(result: StepCounts): boolean {
  return result.imported === 0 && result.skipped === 0 && result.errors.length > 0;
}

/**
 * The exit code for a run with these step results.
 */
export function importExitCode(results: Iterable<StepCounts>): ImportExitCode {
  let rowErrors = false;
  for (const result of results) {
    if (isFailedStep(result)) {
      return IMPORT_EXIT_STEP_FAILED;
    }
    if (result.errors.length > 0) {
      rowErrors = true;
    }
  }
  return rowErrors ? IMPORT_EXIT_ROW_ERRORS : IMPORT_EXIT_CLEAN;
}
