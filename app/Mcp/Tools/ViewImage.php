<?php

namespace App\Mcp\Tools;

use App\Contracts\BurnsCopyright;
use App\Mcp\EntityRegistry;
use App\Mcp\ReadAuthorization;
use App\Support\Images\AttachedImageRegistry;
use App\Support\Images\PublicRenditions;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('view_image')]
#[Description('Shows an attached image (item, collection, partner, contributor or timeline-event image) as the public sees it: its burned rendition, with the copyright drawn in. By default only a rendition already in the cache is shown, so nothing is written; set allow_burn to burn a missing one, exactly as opening its public URL would. Never shows an original.')]
#[IsReadOnly]
class ViewImage extends InventoryTool
{
    /**
     * Larger renditions are left to the public URL.
     */
    private const MAX_BYTES = 5 * 1024 * 1024;

    public function handle(Request $request, PublicRenditions $renditions): Response|ResponseFactory
    {
        $type = (string) $request->get('type');
        $model = EntityRegistry::has($type) ? EntityRegistry::model($type) : null;

        if ($model === null || ! in_array($model, AttachedImageRegistry::modelClasses(), true)) {
            return Response::error("[{$type}] is not an attached-image type.");
        }

        $id = (string) $request->get('id');
        $record = $model::query()->find($id);

        if ($record === null) {
            return Response::error("No {$type} with id [{$id}].");
        }

        if (! ReadAuthorization::mayView($this->user($request), $record)) {
            return Response::error("You may not read this {$type}.");
        }

        $url = route('pub.picture', ['filename' => (string) $record->getAttribute('path')]);

        if (! $record instanceof BurnsCopyright) {
            return Response::text("This image is published without a burned copyright. Its public URL: {$url}");
        }

        $rendition = (bool) $request->get('allow_burn', false)
            ? $renditions->get($record)
            : $renditions->cached($record);

        if ($rendition === null) {
            return Response::text("No rendition of this image is cached yet. Call again with allow_burn to burn it, or open its public URL: {$url}");
        }

        if (strlen($rendition->contents) > self::MAX_BYTES) {
            return Response::text("The rendition is too large to show here. Its public URL: {$url}");
        }

        return Response::make([
            Response::image($rendition->contents, $record->imageMimeType() ?? 'image/jpeg'),
            Response::text("Public URL: {$url}\nCopyright: {$record->resolveCopyright()}"),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'type' => $schema->string()->description('The image type, e.g. item_image')->required(),
            'id' => $schema->string()->description('The image id (UUID)')->required(),
            'allow_burn' => $schema->boolean()->description('Burn and cache the rendition when none is cached (as its public URL would). Default: false, show only a cached one'),
        ];
    }
}
