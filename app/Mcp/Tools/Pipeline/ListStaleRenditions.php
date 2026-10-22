<?php

namespace App\Mcp\Tools\Pipeline;

use App\Contracts\BurnsCopyright;
use App\Contracts\StreamableImageFile;
use App\Mcp\EntityRegistry;
use App\Support\Images\AttachedImageRegistry;
use App\Support\Images\PublicRenditions;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Model;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list_stale_renditions')]
#[Description('Cached renditions burned for an older copyright or burner version (stale), or cached with no record of what they were burned for (unmarked). Each is re-burned on its next request, so this is a health view, not an error list. Scans up to `scan` images; burns nothing.')]
#[IsReadOnly]
class ListStaleRenditions extends PipelineTool
{
    public function handle(Request $request, PublicRenditions $renditions): Response|ResponseFactory
    {
        if (! $this->mayObserve($request)) {
            return Response::error('You may not observe the image pipeline.');
        }

        $budget = max(1, (int) $request->get('scan', 5000));
        $scanned = 0;
        $counts = ['fresh' => 0, 'stale' => 0, 'unmarked' => 0, 'missing' => 0];
        /** @var list<array{type: string|null, id: mixed, path: mixed, state: string}> $found */
        $found = [];

        foreach (AttachedImageRegistry::eachImage() as $image) {
            if ($scanned >= $budget) {
                break;
            }

            if (! $image instanceof BurnsCopyright) {
                continue;
            }

            /** @var Model&StreamableImageFile&BurnsCopyright $image */
            $scanned++;
            $state = $renditions->cacheState($image);
            $counts[$state]++;

            if ($state === 'stale' || $state === 'unmarked') {
                $found[] = [
                    'type' => EntityRegistry::typeOf($image),
                    'id' => $image->getKey(),
                    'path' => $image->getAttribute('path'),
                    'state' => $state,
                ];
            }
        }

        return Response::structured([
            'scanned' => $scanned,
            'complete' => $scanned < $budget,
            'cache' => $counts,
            'renditions' => $this->capped($found, (int) $request->get('limit', 50)),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'scan' => $schema->integer()->min(1)->default(5000)->description('How many images to examine at most'),
            'limit' => $schema->integer()->min(1)->default(50)->description('How many stale renditions to list'),
        ];
    }
}
