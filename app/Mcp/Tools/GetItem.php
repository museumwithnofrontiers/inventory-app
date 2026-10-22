<?php

namespace App\Mcp\Tools;

use App\Mcp\ReadAuthorization;
use App\Models\Item;
use App\Models\ItemImage;
use App\Services\LegacyUrlResolver;
use App\Support\LegacyLinks\LegacyLink;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get_item')]
#[Description('An item sheet, like the websites show it: the item with its translations (per language and context), images (public URL and copyright), partner, project, collections, tags, artists, workshops, dynasties, parent, children and links, and the legacy links (its pages on the legacy websites and back office). Look an item up by id, or by legacy key with find_by_legacy_key.')]
#[IsReadOnly]
class GetItem extends InventoryTool
{
    /**
     * Everything an item sheet shows.
     */
    private const SHEET = [
        'translations.language', 'translations.context',
        'itemImages', 'partner', 'project', 'country', 'collection', 'attachedToCollections',
        'tags', 'artists', 'workshops', 'dynasties',
        'parent', 'children', 'outgoingLinks', 'incomingLinks',
    ];

    public function handle(Request $request): Response|ResponseFactory
    {
        $id = (string) $request->get('id');
        $item = Item::query()->with(self::SHEET)->find($id);

        if ($item === null) {
            return Response::error("No item with id [{$id}].");
        }

        if (! ReadAuthorization::mayView($this->user($request), $item)) {
            return Response::error('You may not read this item.');
        }

        $language = trim((string) $request->get('language', 'en'));

        return Response::structured([
            'item' => $this->present('item', $item),
            // The stable public URL of each image, and the copyright burned into it
            'images' => $item->itemImages->sortBy('display_order')->values()->map(fn (ItemImage $image): array => [
                'id' => $image->id,
                'display_order' => $image->display_order,
                'alt_text' => $image->alt_text,
                'public_url' => route('pub.picture', ['filename' => $image->path]),
                'copyright' => $image->resolveCopyright(),
            ])->all(),
            // The same links the panel's "Legacy links" section shows
            'legacy_links' => array_map(
                fn (LegacyLink $link): array => $link->toArray(),
                app(LegacyUrlResolver::class)->resolveFor($item, $language === '' ? 'en' : $language)->links,
            ),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()->description('The item id (UUID)')->required(),
            'language' => $schema->string()->description('The language of the legacy pages linked in legacy_links (ISO 639-1 or 639-3)')->default('en'),
        ];
    }
}
