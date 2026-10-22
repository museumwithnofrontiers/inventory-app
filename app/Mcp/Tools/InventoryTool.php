<?php

namespace App\Mcp\Tools;

use App\Mcp\EntityRegistry;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Server\Tool;
use RuntimeException;

/**
 * What the browse tools share: the signed-in user, include validation,
 * pagination bounded like the API's, and output through the API resources,
 * so the MCP server returns what the API returns.
 */
abstract class InventoryTool extends Tool
{
    protected function user(Request $request): User
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new RuntimeException('No user is signed in.');
        }

        return $user;
    }

    /**
     * The includes asked for, refused when one is not on the entity's
     * allow-list.
     *
     * @return array<int, string>
     */
    protected function includes(Request $request, string $type): array
    {
        $allowed = EntityRegistry::includes($type);

        /** @var array{include?: array<int, string>} $validated */
        $validated = Validator::validate($request->all(), [
            'include' => ['sometimes', 'array'],
            'include.*' => ['string', Rule::in($allowed)],
        ], [
            'include.*.in' => 'Unknown include [:input] for '.$type.'. Allowed: '.implode(', ', $allowed).'.',
        ]);

        return array_values(array_unique($validated['include'] ?? []));
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return LengthAwarePaginator<int, TModel>
     */
    protected function paginate(Request $request, Builder $query): LengthAwarePaginator
    {
        $page = max(1, (int) $request->get('page', 1));
        $perPage = (int) $request->get('per_page', Config::integer('interface.pagination.default_per_page'));
        $perPage = max(1, min($perPage, Config::integer('interface.pagination.max_per_page')));

        return $query->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * @template TModel of Model
     *
     * @param  LengthAwarePaginator<int, TModel>  $paginator
     * @return array{page: int, per_page: int, total: int, last_page: int}
     */
    protected function pageMeta(LengthAwarePaginator $paginator): array
    {
        return [
            'page' => $paginator->currentPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' => $paginator->lastPage(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function present(string $type, Model $record): array
    {
        $resource = EntityRegistry::resource($type);

        /** @var array<string, mixed> */
        return (new $resource($record))->resolve();
    }

    /**
     * @param  iterable<int, Model>  $records
     * @return array<int, array<string, mixed>>
     */
    protected function presentAll(string $type, iterable $records): array
    {
        $presented = [];

        foreach ($records as $record) {
            $presented[] = $this->present($type, $record);
        }

        return $presented;
    }
}
