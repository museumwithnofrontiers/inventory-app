<?php

namespace App\Mcp\Tools\Pipeline;

use App\Support\Images\AttachedImageAudit;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('audit_attached_images')]
#[Description('Checks every attached-image model (item, collection, partner, partner translation, contributor and timeline-event images, partner logos): the registry contract, row counts, rows without a path, paths used twice, and rows whose original is missing from its private disk. The same audit as images:attached-registry-audit.')]
#[IsReadOnly]
class AuditAttachedImages extends PipelineTool
{
    public function handle(Request $request, AttachedImageAudit $audit): Response|ResponseFactory
    {
        if (! $this->mayObserve($request)) {
            return Response::error('You may not observe the image pipeline.');
        }

        $report = $audit->run();
        $report['models'] = array_map(fn (array $model): array => [
            ...$model,
            'missing_originals' => $this->capped($model['missing_originals']),
            'duplicate_paths' => $this->capped($model['duplicate_paths']),
            'empty_path_ids' => $this->capped($model['empty_path_ids']),
        ], $report['models']);

        return Response::structured($report);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [];
    }
}
