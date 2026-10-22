<?php

namespace App\Mcp\Tools;

use App\Mcp\EntityRegistry;
use App\Mcp\ReadAuthorization;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('describe_entity')]
#[Description('What an entity type holds: its fields (usable as search filters), the fields free-text search looks in, the related records get can include, and whether it has translations, an `extra` JSON field or images.')]
#[IsReadOnly]
class DescribeEntity extends InventoryTool
{
    public function handle(Request $request): Response|ResponseFactory
    {
        $type = (string) $request->get('type');

        if (! EntityRegistry::has($type)) {
            return Response::error("Unknown entity type [{$type}]. Call list_entity_types for the known types.");
        }

        $columns = EntityRegistry::columns($type);
        $includes = EntityRegistry::includes($type);

        return Response::structured([
            'type' => $type,
            'may_read' => ReadAuthorization::mayViewAny($this->user($request), EntityRegistry::model($type)),
            'fields' => $columns,
            'search_fields' => EntityRegistry::searchColumns($type),
            'includes' => $includes,
            'has_translations' => in_array('translations', $includes, true),
            'has_extra' => in_array('extra', $columns, true),
            'has_legacy_key' => in_array('backward_compatibility', $columns, true),
            'image_includes' => array_values(array_filter($includes, fn (string $include): bool => str_contains(strtolower($include), 'image'))),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'type' => $schema->string()->description('An entity type from list_entity_types, e.g. item')->required(),
        ];
    }
}
