<?php

namespace App\Mcp\Tools\Pipeline;

use App\Models\ImageUpload;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list_pending_uploads')]
#[Description('Uploads not yet turned into available images, oldest first, with their age and whether their file is still on the uploads disk. An upload older than a few minutes is stuck: ImageUploadListener did not finish it.')]
#[IsReadOnly]
class ListPendingUploads extends PipelineTool
{
    public function handle(Request $request): Response|ResponseFactory
    {
        if (! $this->mayObserve($request)) {
            return Response::error('You may not observe the image pipeline.');
        }

        $disk = Config::string('localstorage.uploads.images.disk');
        $directory = trim(Config::string('localstorage.uploads.images.directory'), '/');

        $uploads = ImageUpload::query()->oldest()->get()->map(fn (ImageUpload $upload): array => [
            'id' => $upload->id,
            'name' => $upload->name,
            'mime_type' => $upload->mime_type,
            'size' => $upload->size,
            'uploaded_at' => $upload->created_at?->toIso8601String(),
            'age_minutes' => $upload->created_at !== null ? (int) $upload->created_at->diffInMinutes(now()) : null,
            'file_present' => Storage::disk($disk)->exists($directory.'/'.$upload->path),
        ])->all();

        return Response::structured(['uploads' => $this->capped($uploads, (int) $request->get('limit', 50))]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'limit' => $schema->integer()->min(1)->default(50)->description('How many to list'),
        ];
    }
}
