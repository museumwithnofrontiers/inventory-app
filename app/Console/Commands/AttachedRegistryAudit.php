<?php

namespace App\Console\Commands;

use App\Support\Images\AttachedImageAudit;
use Illuminate\Console\Command;

class AttachedRegistryAudit extends Command
{
    protected $signature = 'images:attached-registry-audit
                            {--json : Output results as JSON}
                            {--fail-on-issues : Return a non-zero exit code when any issue is detected}';

    protected $description = 'Audit the attached-image registry: report row counts, missing originals, duplicate paths, and empty paths per registered model';

    public function handle(AttachedImageAudit $audit): int
    {
        $report = $audit->run();

        if (! $report['registry_valid']) {
            $this->error('Registry validation failed: '.$report['registry_error']);

            return Command::FAILURE;
        }

        if ($this->option('json')) {
            $this->line((string) json_encode([
                'registry_valid' => true,
                'has_issues' => $report['has_issues'],
                'models' => $report['models'],
            ], JSON_PRETTY_PRINT));
        } else {
            $this->outputTable($report['models'], $report['has_issues']);
        }

        if ($this->option('fail-on-issues') && $report['has_issues']) {
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }

    /**
     * @param  list<array{class: class-string, table: string, row_count: int, distinct_paths: int, missing_originals: list<string>, duplicate_paths: list<string>, empty_path_ids: list<string>}>  $results
     */
    private function outputTable(array $results, bool $hasIssues): void
    {
        $this->info('Attached Image Registry Audit');
        $this->info(str_repeat('=', 60));

        foreach ($results as $result) {
            $this->newLine();
            $this->line("<fg=cyan>{$result['class']}</>");
            $this->line("  Table:           {$result['table']}");
            $this->line("  Rows:            {$result['row_count']}");
            $this->line("  Distinct paths:  {$result['distinct_paths']}");

            if (! empty($result['missing_originals'])) {
                $this->warn('  Missing originals ('.count($result['missing_originals']).')');
                foreach ($result['missing_originals'] as $path) {
                    $this->line("    - {$path}");
                }
            }

            if (! empty($result['duplicate_paths'])) {
                $this->warn('  Duplicate paths ('.count($result['duplicate_paths']).')');
                foreach ($result['duplicate_paths'] as $path) {
                    $this->line("    - {$path}");
                }
            }

            if (! empty($result['empty_path_ids'])) {
                $this->warn('  Empty path rows ('.count($result['empty_path_ids']).')');
                foreach ($result['empty_path_ids'] as $id) {
                    $this->line("    - ID: {$id}");
                }
            }

            if (empty($result['missing_originals']) && empty($result['duplicate_paths']) && empty($result['empty_path_ids'])) {
                $this->line('  <fg=green>No issues found.</>');
            }
        }

        $this->newLine();
        $this->info(str_repeat('=', 60));

        if ($hasIssues) {
            $this->warn('Audit complete: issues detected (see above).');
        } else {
            $this->info('Audit complete: no issues found.');
        }
    }
}
