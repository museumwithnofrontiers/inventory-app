<?php

namespace App\Mcp\Tools\Pipeline;

use App\Support\Images\ImageOrphans;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Carbon;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('find_orphans')]
#[Description('Image files no row references: on the private originals disk (left behind when a database cascade deleted the image row) or in the pictures cache. Reports only; images:cleanup-originals and images:cleanup-pictures remove them. Originals younger than an hour are skipped by default, as an upload may be writing one.')]
#[IsReadOnly]
class FindOrphans extends PipelineTool
{
    public function handle(Request $request, ImageOrphans $orphans): Response|ResponseFactory
    {
        if (! $this->mayObserve($request)) {
            return Response::error('You may not observe the image pipeline.');
        }

        $where = (string) $request->get('disk', 'originals');

        if (! in_array($where, ['originals', 'pictures'], true)) {
            return Response::error('disk is originals or pictures.');
        }

        $hours = $request->get('older_than_hours', $where === 'originals' ? 1 : null);
        $olderThan = is_numeric($hours) ? Carbon::now()->subHours((int) $hours) : null;

        $found = $where === 'originals' ? $orphans->originals($olderThan) : $orphans->pictures($olderThan);
        $found['orphans'] = $this->capped($found['orphans'], (int) $request->get('limit', 50));

        return Response::structured(['where' => $where, ...$found]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'disk' => $schema->string()->enum(['originals', 'pictures'])->default('originals'),
            'older_than_hours' => $schema->integer()->min(0)->description('Skip files modified more recently (default: 1 for originals, none for pictures)'),
            'limit' => $schema->integer()->min(1)->default(50)->description('How many orphans to list'),
        ];
    }
}
