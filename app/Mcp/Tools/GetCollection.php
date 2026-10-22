<?php

namespace App\Mcp\Tools;

use App\Mcp\ReadAuthorization;
use App\Models\Collection;
use App\Models\Item;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get_collection')]
#[Description('A collection with its translations, parent, child collections and partners, and one page of its member items. Members are the items that belong to it natively (their collection) together with the items attached to it, as the websites list them. Walk the tree through `children` and `parent`.')]
#[IsReadOnly]
class GetCollection extends InventoryTool
{
    public function handle(Request $request): Response|ResponseFactory
    {
        $id = (string) $request->get('id');
        $collection = Collection::query()
            ->with(['translations.language', 'translations.context', 'parent', 'children', 'partners'])
            ->find($id);

        if ($collection === null) {
            return Response::error("No collection with id [{$id}].");
        }

        $user = $this->user($request);

        if (! ReadAuthorization::mayView($user, $collection)) {
            return Response::error('You may not read this collection.');
        }

        $result = [
            'collection' => $this->present('collection', $collection),
        ];

        if (ReadAuthorization::mayViewAny($user, Item::class)) {
            $members = Item::query()
                ->where(fn (Builder $query) => $query
                    ->where('collection_id', $collection->id)
                    ->orWhereHas('attachedToCollections', fn (Builder $attached) => $attached->whereKey($collection->id)))
                ->orderBy('internal_name');
            $page = $this->paginate($request, $members);

            $result['members'] = $this->presentAll('item', $page->items());
            $result['members_meta'] = $this->pageMeta($page);
        }

        return Response::structured($result);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()->description('The collection id (UUID)')->required(),
            'page' => $schema->integer()->min(1)->default(1)->description('Page of member items'),
            'per_page' => $schema->integer()->min(1)->description('Member items per page, bounded like the REST API'),
        ];
    }
}
