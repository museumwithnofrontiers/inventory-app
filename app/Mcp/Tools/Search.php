<?php

namespace App\Mcp\Tools;

use App\Mcp\EntityRegistry;
use App\Mcp\ReadAuthorization;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('search')]
#[Description('Find records of one entity type. `q` matches the id, internal name, legacy key or name (substring); `filters` match fields exactly, e.g. {"project_id": "…", "type": "object"}. Paginated; results are shaped like the REST API\'s.')]
#[IsReadOnly]
class Search extends InventoryTool
{
    public function handle(Request $request): Response|ResponseFactory
    {
        $type = (string) $request->get('type');

        if (! EntityRegistry::has($type)) {
            return Response::error("Unknown entity type [{$type}]. Call list_entity_types for the known types.");
        }

        $model = EntityRegistry::model($type);

        if (! ReadAuthorization::mayViewAny($this->user($request), $model)) {
            return Response::error("You may not read {$type} records.");
        }

        $columns = EntityRegistry::columns($type);
        $filters = $request->get('filters', []);
        $filters = is_array($filters) ? $filters : [];
        $unknown = array_diff(array_keys($filters), $columns);

        if ($unknown !== []) {
            return Response::error('Unknown filter field(s) for '.$type.': '.implode(', ', $unknown).'. Fields: '.implode(', ', $columns).'.');
        }

        $query = $model::query()->with($this->includes($request, $type));

        foreach ($filters as $column => $value) {
            $value === null
                ? $query->whereNull((string) $column)
                : $query->where((string) $column, is_scalar($value) ? $value : json_encode($value));
        }

        $text = trim((string) $request->get('q', ''));

        if ($text !== '') {
            $query->where(function (Builder $query) use ($type, $text): void {
                foreach (EntityRegistry::searchColumns($type) as $column) {
                    $query->orWhere($column, 'like', '%'.$text.'%');
                }
            });
        }

        $query->orderBy(in_array('internal_name', $columns, true) ? 'internal_name' : $query->getModel()->getKeyName());

        $page = $this->paginate($request, $query);

        return Response::structured([
            'type' => $type,
            'data' => $this->presentAll($type, $page->items()),
            'meta' => $this->pageMeta($page),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'type' => $schema->string()->description('An entity type from list_entity_types')->required(),
            'q' => $schema->string()->description('Free text matched against id, internal name, legacy key and name'),
            'filters' => $schema->object()->description('Exact matches on fields, e.g. {"project_id": "…"}; null matches an empty field'),
            'include' => $schema->array()->items($schema->string())->description('Related records to include (see describe_entity)'),
            'page' => $schema->integer()->min(1)->default(1),
            'per_page' => $schema->integer()->min(1)->description('Bounded like the REST API'),
        ];
    }
}
