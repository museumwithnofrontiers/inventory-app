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

#[Name('find_by_legacy_key')]
#[Description('The records imported from a legacy record, across every entity type you may read, by their legacy key (backward_compatibility, e.g. "mwnf3:objects:EPM:dn:Mus21:50"). Exact match by default; `prefix` finds every key starting with the value.')]
#[IsReadOnly]
class FindByLegacyKey extends InventoryTool
{
    private const LIMIT_PER_TYPE = 20;

    public function handle(Request $request): Response|ResponseFactory
    {
        $key = trim((string) $request->get('key'));

        if ($key === '') {
            return Response::error('Give the legacy key to look for.');
        }

        $prefix = (bool) $request->get('prefix', false);
        $user = $this->user($request);
        $matches = [];

        foreach (EntityRegistry::types() as $type) {
            $model = EntityRegistry::model($type);

            if (! in_array('backward_compatibility', EntityRegistry::columns($type), true)
                || ! ReadAuthorization::mayViewAny($user, $model)) {
                continue;
            }

            $records = $model::query()
                ->when(
                    $prefix,
                    fn ($query) => $query->where('backward_compatibility', 'like', addcslashes($key, '%_\\').'%'),
                    fn ($query) => $query->where('backward_compatibility', $key),
                )
                ->limit(self::LIMIT_PER_TYPE)
                ->get();

            foreach ($records as $record) {
                $matches[] = ['type' => $type, 'data' => $this->present($type, $record)];
            }
        }

        return Response::structured(['key' => $key, 'prefix' => $prefix, 'matches' => $matches]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'key' => $schema->string()->description('The legacy key (backward_compatibility)')->required(),
            'prefix' => $schema->boolean()->description('Match every key starting with the value'),
        ];
    }
}
