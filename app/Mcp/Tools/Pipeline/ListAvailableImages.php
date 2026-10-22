<?php

namespace App\Mcp\Tools\Pipeline;

use App\Models\AvailableImage;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Storage;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list_available_images')]
#[Description('The pool of processed images waiting to be attached, oldest first: their age, whether the original is on its private disk, size and MIME type. Images leave the pool when attached and return to it when detached.')]
#[IsReadOnly]
class ListAvailableImages extends PipelineTool
{
    public function handle(Request $request): Response|ResponseFactory
    {
        if (! $this->mayObserve($request)) {
            return Response::error('You may not observe the image pipeline.');
        }

        $olderThanDays = $request->get('older_than_days');
        $query = AvailableImage::query()->oldest();

        if (is_numeric($olderThanDays)) {
            $query->where('created_at', '<', now()->subDays((int) $olderThanDays));
        }

        $images = $query->get()->map(function (AvailableImage $image): array {
            $disk = Storage::disk($image->imageDisk());
            $present = $disk->exists($image->imageStoragePath());

            return [
                'id' => $image->id,
                'path' => $image->path,
                'comment' => $image->comment,
                'mime_type' => $image->imageMimeType(),
                'added_at' => $image->created_at?->toIso8601String(),
                'original_present' => $present,
                'size' => $present ? $disk->size($image->imageStoragePath()) : null,
            ];
        })->all();

        return Response::structured(['available_images' => $this->capped($images, (int) $request->get('limit', 50))]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'older_than_days' => $schema->integer()->min(0)->description('Only images in the pool for longer than this'),
            'limit' => $schema->integer()->min(1)->default(50)->description('How many to list'),
        ];
    }
}
