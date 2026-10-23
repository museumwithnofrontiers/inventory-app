<?php

namespace App\Mcp\Tools;

use App\Mcp\ReadAuthorization;
use App\Models\Item;
use App\Models\Tag;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('find_items_by_tags')]
#[Description('The items carrying some tags. Name each tag by its id, legacy key, internal name or description (exact; list_tags finds them). A name can match several tags, e.g. the same word as keyword and as material: any of them counts. `match` "all" (default) wants every tag on the item, "any" one of them. Narrow with project_id and type. Paginated; items come with their tags.')]
#[IsReadOnly]
class FindItemsByTags extends InventoryTool
{
    private const MATCHES = ['all', 'any'];

    /**
     * Enough for any sensible combination, few enough to keep the query small.
     */
    private const MAX_TAGS = 20;

    public function handle(Request $request): Response|ResponseFactory
    {
        // A search over items: reading items is what it takes, as it is to
        // see their tags; managing tags (TagPolicy) is not needed
        if (! ReadAuthorization::mayViewAny($this->user($request), Item::class)) {
            return Response::error('You may not read items.');
        }

        $names = $request->get('tags', []);
        $names = array_values(array_unique(array_filter(
            array_map(fn (mixed $name): string => is_scalar($name) ? trim((string) $name) : '', is_array($names) ? $names : [$names]),
            fn (string $name): bool => $name !== '',
        )));

        if ($names === [] || count($names) > self::MAX_TAGS) {
            return Response::error('Name between 1 and '.self::MAX_TAGS.' tags.');
        }

        $match = (string) $request->get('match', 'all');

        if (! in_array($match, self::MATCHES, true)) {
            return Response::error('Unknown match ['.$match.']. Use one of: '.implode(', ', self::MATCHES).'.');
        }

        // The tags each name stands for
        $groups = [];

        foreach ($names as $name) {
            $tags = $this->tagsNamed($name);

            if ($tags->isNotEmpty()) {
                $groups[$name] = $tags;
            }
        }

        $unmatched = array_values(array_diff($names, array_keys($groups)));

        if ($groups === [] || ($match === 'all' && $unmatched !== [])) {
            return Response::error('No tag matches: '.implode(', ', $unmatched).'. Call list_tags to find the tags.');
        }

        $includes = array_values(array_unique([...$this->includes($request, 'item'), 'tags']));
        $query = Item::query()->with($includes);

        $tagIds = fn (Collection $tags): array => $tags->modelKeys();

        if ($match === 'all') {
            foreach ($groups as $tags) {
                $query->whereHas('tags', fn (Builder $query): Builder => $query->whereIn('tags.id', $tagIds($tags)));
            }
        } else {
            $query->whereHas('tags', fn (Builder $query): Builder => $query->whereIn('tags.id', collect($groups)->flatMap($tagIds)->unique()->values()->all()));
        }

        foreach (['project_id', 'type'] as $column) {
            $value = $request->get($column);

            if (is_string($value) && $value !== '') {
                $query->where($column, $value);
            }
        }

        $page = $this->paginate($request, $query->orderBy('internal_name'));

        return Response::structured([
            'match' => $match,
            // What each name was taken to mean
            'tags' => collect($groups)->map(fn (Collection $tags): array => $this->presentAll('tag', $tags))->all(),
            'unmatched' => $unmatched,
            'data' => $this->presentAll('item', $page->items()),
            'meta' => $this->pageMeta($page),
        ]);
    }

    /**
     * The tags a name stands for: by id, legacy key, internal name or
     * description. Imported tags keep a lower-cased internal name next to
     * the description as written, hence the lower-cased comparison.
     *
     * @return Collection<int, Tag>
     */
    private function tagsNamed(string $name): Collection
    {
        return Tag::query()
            ->where(fn (Builder $query): Builder => $query
                ->whereKey($name)
                ->orWhere('backward_compatibility', $name)
                ->orWhereIn('internal_name', array_unique([$name, mb_strtolower($name)]))
                ->orWhere('description', $name))
            ->get();
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'tags' => $schema->array()->items($schema->string())->description('Tag ids, legacy keys, internal names or descriptions')->required(),
            'match' => $schema->string()->enum(self::MATCHES)->default('all')->description('Items with all the tags, or with any of them'),
            'project_id' => $schema->string()->description('Only items of this project'),
            'type' => $schema->string()->description('Only items of this type, e.g. object or monument'),
            'include' => $schema->array()->items($schema->string())->description('Related records to include (see describe_entity for item); tags always are'),
            'page' => $schema->integer()->min(1)->default(1),
            'per_page' => $schema->integer()->min(1)->description('Bounded like the REST API'),
        ];
    }
}
