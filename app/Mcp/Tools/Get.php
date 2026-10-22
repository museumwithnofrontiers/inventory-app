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

#[Name('get')]
#[Description('One record of an entity type by its id, shaped like the REST API\'s, with the related records asked for in `include` (see describe_entity).')]
#[IsReadOnly]
class Get extends InventoryTool
{
    public function handle(Request $request): Response|ResponseFactory
    {
        $type = (string) $request->get('type');

        if (! EntityRegistry::has($type)) {
            return Response::error("Unknown entity type [{$type}]. Call list_entity_types for the known types.");
        }

        $id = (string) $request->get('id');
        $model = EntityRegistry::model($type);
        $record = $model::query()->find($id);

        if ($record === null) {
            return Response::error("No {$type} with id [{$id}].");
        }

        if (! ReadAuthorization::mayView($this->user($request), $record)) {
            return Response::error("You may not read this {$type}.");
        }

        $record->load($this->includes($request, $type));

        return Response::structured([
            'type' => $type,
            'data' => $this->present($type, $record),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'type' => $schema->string()->description('An entity type from list_entity_types')->required(),
            'id' => $schema->string()->description('The record id (a UUID; an ISO code for language and country)')->required(),
            'include' => $schema->array()->items($schema->string())->description('Related records to include (see describe_entity)'),
        ];
    }
}
