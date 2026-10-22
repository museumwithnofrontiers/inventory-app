<?php

namespace App\Mcp\Tools\Pipeline;

use App\Contracts\BurnsCopyright;
use App\Contracts\StreamableImageFile;
use App\Mcp\EntityRegistry;
use App\Models\AvailableImage;
use App\Models\ImageUpload;
use App\Support\Images\AttachedImageRegistry;
use App\Support\Images\PublicRenditions;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('trace_image')]
#[Description('Where one image stands in the pipeline, found by id, filename or public URL: its stage (upload, available, attached), the record that owns it, its original (disk, path, present, size, checksum: metadata only), its resolved copyright and where that comes from (image, project or fallback), and its rendition in the pictures cache (fresh, stale, unmarked or missing) with its public URL. The id stays the same from upload to attachment.')]
#[IsReadOnly]
class TraceImage extends PipelineTool
{
    public function handle(Request $request, PublicRenditions $renditions): Response|ResponseFactory
    {
        if (! $this->mayObserve($request)) {
            return Response::error('You may not observe the image pipeline.');
        }

        $ref = trim((string) $request->get('ref'));
        $filename = basename((string) (parse_url($ref, PHP_URL_PATH) ?: $ref));

        if ($upload = ImageUpload::query()->whereKey($ref)->orWhere('path', $filename)->first()) {
            return Response::structured(['stage' => 'upload', ...$this->upload($upload)]);
        }

        $attached = $this->findAttached($ref) ?? AttachedImageRegistry::findByPath($filename);

        if ($attached !== null) {
            return Response::structured(['stage' => 'attached', ...$this->attached($attached, $renditions)]);
        }

        if ($available = AvailableImage::query()->whereKey($ref)->orWhere('path', $filename)->first()) {
            return Response::structured(['stage' => 'available', 'id' => $available->id, ...$this->original($available)]);
        }

        return Response::error("No image found for [{$ref}] at any stage.");
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'ref' => $schema->string()->description('The image id, its filename, or its public URL (/pub/…)')->required(),
        ];
    }

    private function findAttached(string $id): ?Model
    {
        foreach (AttachedImageRegistry::modelClasses() as $class) {
            if ($record = $class::query()->find($id)) {
                return $record;
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function upload(ImageUpload $upload): array
    {
        $disk = Config::string('localstorage.uploads.images.disk');
        $path = trim(Config::string('localstorage.uploads.images.directory'), '/').'/'.$upload->path;

        return [
            'id' => $upload->id,
            'name' => $upload->name,
            'uploaded_at' => $upload->created_at?->toIso8601String(),
            'file' => ['disk' => $disk, 'path' => $path, 'present' => Storage::disk($disk)->exists($path)],
            'note' => 'Still an upload: ImageUploadListener has not turned it into an available image yet.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function attached(Model $record, PublicRenditions $renditions): array
    {
        $result = [
            'type' => EntityRegistry::typeOf($record),
            'id' => $record->getKey(),
            'owner' => $this->owner($record),
            'public_url' => route('pub.picture', ['filename' => (string) $record->getAttribute('path')]),
            ...$this->original($record),
        ];

        if ($record instanceof BurnsCopyright) {
            /** @var Model&StreamableImageFile&BurnsCopyright $record */
            $result['copyright'] = [
                'text' => $record->resolveCopyright(),
                'source' => method_exists($record, 'copyrightSource') ? $record->copyrightSource() : null,
            ];
            $result['rendition'] = [
                'cache' => $renditions->cacheState($record),
                'etag' => $renditions->etag($record),
            ];
        } else {
            $result['rendition'] = ['cache' => 'not burned: published as is'];
        }

        return $result;
    }

    /**
     * The record an attached image belongs to, from its foreign keys.
     *
     * @return array<string, mixed>
     */
    private function owner(Model $record): array
    {
        return array_filter(
            $record->only(array_filter(array_keys($record->getAttributes()), fn (string $key): bool => str_ends_with($key, '_id'))),
            fn (mixed $value): bool => $value !== null,
        );
    }

    /**
     * @return array{original: array{disk: string, path: string, present: bool, size: int|null, sha256: string|null}}
     */
    private function original(Model $record): array
    {
        /** @var Model&StreamableImageFile $record */
        $disk = Storage::disk($record->imageDisk());
        $path = $record->imageStoragePath();
        $present = $disk->exists($path);
        $stream = $present ? $disk->readStream($path) : null;
        $sha256 = null;

        if (is_resource($stream)) {
            $context = hash_init('sha256');
            hash_update_stream($context, $stream);
            fclose($stream);
            $sha256 = hash_final($context);
        }

        return ['original' => [
            'disk' => $record->imageDisk(),
            'path' => $path,
            'present' => $present,
            'size' => $present ? $disk->size($path) : null,
            'sha256' => $sha256,
        ]];
    }
}
