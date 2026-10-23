<?php

namespace App\Mcp\Tools;

use App\Mcp\ReadAuthorization;
use App\Models\Item;
use App\Models\Tag;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list_tags')]
#[Description('The tags (keywords, materials…) with the number of items carrying each, most used first. `q` matches the tag\'s internal name, description or legacy key (substring); `category` and `language_id` narrow the list. Pass tags on to find_items_by_tags to get their items.')]
#[IsReadOnly]
class ListTags extends InventoryTool
{
    private const ORDERS = ['items', 'name'];

    public function handle(Request $request): Response|ResponseFactory
    {
        // Tags are read here as what items carry, which anyone who may read
        // items sees on them; managing tags (TagPolicy) is not needed
        if (! ReadAuthorization::mayViewAny($this->user($request), Item::class)) {
            return Response::error('You may not read items.');
        }

        $order = (string) $request->get('order', 'items');

        if (! in_array($order, self::ORDERS, true)) {
            return Response::error('Unknown order ['.$order.']. Use one of: '.implode(', ', self::ORDERS).'.');
        }

        $query = Tag::query()->withCount('items');

        $text = trim((string) $request->get('q', ''));

        if ($text !== '') {
            $query->where(function (Builder $query) use ($text): void {
                foreach (['internal_name', 'description', 'backward_compatibility'] as $column) {
                    $query->orWhere($column, 'like', '%'.$text.'%');
                }
            });
        }

        foreach (['category', 'language_id'] as $column) {
            $value = $request->get($column);

            if (is_string($value) && $value !== '') {
                $query->where($column, $value);
            }
        }

        $order === 'items'
            ? $query->orderByDesc('items_count')->orderBy('internal_name')
            : $query->orderBy('internal_name');

        $page = $this->paginate($request, $query);

        return Response::structured([
            'data' => collect($page->items())->map(fn (Tag $tag): array => [
                ...$this->present('tag', $tag),
                'items_count' => $tag->items_count,
            ])->all(),
            'meta' => $this->pageMeta($page),
            // What `category` can be set to
            'categories' => Tag::query()->whereNotNull('category')->distinct()->orderBy('category')->pluck('category')->all(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'q' => $schema->string()->description('Free text matched against the internal name, description and legacy key'),
            'category' => $schema->string()->description('Only tags of this category, e.g. keyword or material'),
            'language_id' => $schema->string()->description('Only tags in this language (ISO 639-3), e.g. eng'),
            'order' => $schema->string()->enum(self::ORDERS)->default('items')->description('Most used first (items), or by internal name (name)'),
            'page' => $schema->integer()->min(1)->default(1),
            'per_page' => $schema->integer()->min(1)->description('Bounded like the REST API'),
        ];
    }
}
