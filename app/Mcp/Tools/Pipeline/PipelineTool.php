<?php

namespace App\Mcp\Tools\Pipeline;

use App\Mcp\ReadAuthorization;
use App\Mcp\Tools\InventoryTool;
use App\Models\AvailableImage;
use Laravel\Mcp\Request;

/**
 * The image-pipeline observation tools. They only read: no tool writes to a
 * disk or a table, triggers a burn, or returns an original's bytes. Reading
 * the pipeline needs what reading available images needs on the API.
 */
abstract class PipelineTool extends InventoryTool
{
    protected function mayObserve(Request $request): bool
    {
        return ReadAuthorization::mayViewAny($this->user($request), AvailableImage::class);
    }

    /**
     * Lists are capped so a large pipeline can't flood the conversation.
     *
     * @template T
     *
     * @param  array<int, T>  $items
     * @return array{count: int, shown: array<int, T>, truncated: bool}
     */
    protected function capped(array $items, int $limit = 50): array
    {
        return [
            'count' => count($items),
            'shown' => array_slice($items, 0, $limit),
            'truncated' => count($items) > $limit,
        ];
    }
}
