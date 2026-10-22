<?php

namespace App\Support\Images;

use App\Contracts\StreamableImageFile;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Checks every registered attached-image model: row counts, rows without a
 * path, paths used twice, and rows whose original is missing from its
 * private disk. Read-only. Used by images:attached-registry-audit and the
 * MCP server's audit_attached_images tool.
 *
 * Originals are checked where each model says they live (imageDisk() and
 * imageStoragePath()); the pictures disk is only a cache of renditions,
 * so a file missing there is not an issue.
 */
final class AttachedImageAudit
{
    /**
     * @return array{
     *     registry_valid: bool,
     *     registry_error: string|null,
     *     has_issues: bool,
     *     models: list<array{class: class-string, table: string, row_count: int, distinct_paths: int, missing_originals: list<string>, duplicate_paths: list<string>, empty_path_ids: list<string>}>
     * }
     */
    public function run(): array
    {
        try {
            AttachedImageRegistry::validate();
        } catch (RuntimeException $e) {
            return ['registry_valid' => false, 'registry_error' => $e->getMessage(), 'has_issues' => true, 'models' => []];
        }

        $models = [];
        $hasIssues = false;

        foreach (AttachedImageRegistry::modelClasses() as $class) {
            $result = $this->audit($class);
            $hasIssues = $hasIssues || $result['missing_originals'] !== [] || $result['duplicate_paths'] !== [] || $result['empty_path_ids'] !== [];
            $models[] = $result;
        }

        return ['registry_valid' => true, 'registry_error' => null, 'has_issues' => $hasIssues, 'models' => $models];
    }

    /**
     * @param  class-string<Model&StreamableImageFile>  $class
     * @return array{class: class-string, table: string, row_count: int, distinct_paths: int, missing_originals: list<string>, duplicate_paths: list<string>, empty_path_ids: list<string>}
     */
    private function audit(string $class): array
    {
        $rowCount = 0;
        $paths = [];
        $missing = [];
        $empty = [];

        $class::query()->chunkById(500, function ($records) use (&$rowCount, &$paths, &$missing, &$empty): void {
            foreach ($records as $record) {
                /** @var Model&StreamableImageFile $record */
                $rowCount++;
                $path = $record->getAttribute('path');

                if (! is_string($path) || $path === '') {
                    $key = $record->getKey();
                    $empty[] = is_scalar($key) ? (string) $key : '';

                    continue;
                }

                $paths[] = $path;

                if (! Storage::disk($record->imageDisk())->exists($record->imageStoragePath())) {
                    $missing[] = $record->imageStoragePath();
                }
            }
        });

        $counts = array_count_values($paths);

        return [
            'class' => $class,
            'table' => (new $class)->getTable(),
            'row_count' => $rowCount,
            'distinct_paths' => count($counts),
            'missing_originals' => $missing,
            'duplicate_paths' => array_map('strval', array_keys(array_filter($counts, fn (int $count): bool => $count > 1))),
            'empty_path_ids' => $empty,
        ];
    }
}
