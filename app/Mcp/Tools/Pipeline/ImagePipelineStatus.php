<?php

namespace App\Mcp\Tools\Pipeline;

use App\Models\AvailableImage;
use App\Models\ImageUpload;
use App\Support\Images\AttachedImageAudit;
use App\Support\Images\ImageOrphans;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Queue\Failed\FailedJobProviderInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('image_pipeline_status')]
#[Description('One overview of the image pipeline, stage by stage: uploads waiting (and stuck), the available pool, attached images per model with missing originals, orphaned files on the originals disk and in the pictures cache, and the queue. Follow up with trace_image, list_pending_uploads, list_available_images, audit_attached_images, find_orphans, list_stale_renditions or queue_status.')]
#[IsReadOnly]
class ImagePipelineStatus extends PipelineTool
{
    /**
     * An upload still pending after this long is stuck: the listener
     * normally finishes it within the request.
     */
    private const STUCK_AFTER_MINUTES = 10;

    public function handle(
        Request $request,
        AttachedImageAudit $audit,
        ImageOrphans $orphans,
        FailedJobProviderInterface $failer,
    ): Response|ResponseFactory {
        if (! $this->mayObserve($request)) {
            return Response::error('You may not observe the image pipeline.');
        }

        $report = $audit->run();
        $originals = $orphans->originals(Carbon::now()->subHour());
        $pictures = $orphans->pictures();

        return Response::structured([
            'uploads' => $this->uploads(),
            'available_images' => $this->availableImages(),
            'attached' => [
                'registry_valid' => $report['registry_valid'],
                'registry_error' => $report['registry_error'],
                'has_issues' => $report['has_issues'],
                'models' => array_map(fn (array $model): array => [
                    'table' => $model['table'],
                    'rows' => $model['row_count'],
                    'missing_originals' => count($model['missing_originals']),
                    'duplicate_paths' => count($model['duplicate_paths']),
                    'empty_paths' => count($model['empty_path_ids']),
                ], $report['models']),
            ],
            // Unreferenced originals younger than an hour may be uploads in progress
            'originals_disk' => ['files' => $originals['scanned'], 'orphans' => count($originals['orphans']), 'recent_unreferenced' => $originals['skipped']],
            'pictures_cache' => ['files' => $pictures['scanned'], 'orphans' => count($pictures['orphans'])],
            'queue' => [
                'connection' => Config::string('queue.default'),
                'pending' => Queue::size(),
                'failed' => count($failer->all()),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [];
    }

    /**
     * @return array{pending: int, stuck: int, files_missing: int}
     */
    private function uploads(): array
    {
        $disk = Storage::disk(Config::string('localstorage.uploads.images.disk'));
        $directory = trim(Config::string('localstorage.uploads.images.directory'), '/');
        $uploads = ImageUpload::query()->get(['id', 'path', 'created_at']);

        return [
            'pending' => $uploads->count(),
            'stuck' => $uploads->filter(fn (ImageUpload $upload): bool => $upload->created_at !== null
                && $upload->created_at->lt(Carbon::now()->subMinutes(self::STUCK_AFTER_MINUTES)))->count(),
            'files_missing' => $uploads->reject(fn (ImageUpload $upload): bool => $disk->exists($directory.'/'.$upload->path))->count(),
        ];
    }

    /**
     * @return array{count: int, originals_missing: int}
     */
    private function availableImages(): array
    {
        $images = AvailableImage::query()->get();

        return [
            'count' => $images->count(),
            'originals_missing' => $images->reject(fn (AvailableImage $image): bool => Storage::disk($image->imageDisk())->exists($image->imageStoragePath()))->count(),
        ];
    }
}
