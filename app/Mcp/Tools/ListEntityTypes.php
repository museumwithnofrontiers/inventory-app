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

#[Name('list_entity_types')]
#[Description('The inventory entity types (item, collection, partner, their translations and images, reference data…) and whether you may read each. Pass a type to describe_entity, search and get.')]
#[IsReadOnly]
class ListEntityTypes extends InventoryTool
{
    public function handle(Request $request): Response|ResponseFactory
    {
        $user = $this->user($request);

        $types = array_map(fn (string $type): array => [
            'type' => $type,
            'may_read' => ReadAuthorization::mayViewAny($user, EntityRegistry::model($type)),
        ], EntityRegistry::types());

        return Response::structured(['types' => $types]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [];
    }
}
