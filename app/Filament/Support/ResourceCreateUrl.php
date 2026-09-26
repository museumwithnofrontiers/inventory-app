<?php

namespace App\Filament\Support;

use App\Filament\Concerns\PrefillsCreateFormFromQuery;
use Filament\Resources\Resource;
use InvalidArgumentException;

/**
 * The one place in app/Filament that builds a create-page query string (M7
 * epic #1871, story A0.3).
 *
 * The has-many convention's header `Create` action navigates a relation
 * manager to the child Resource's create page with the owning foreign key
 * (and sometimes a fixed value like `type`) pre-filled, e.g.:
 *
 *     ResourceCreateUrl::for(ItemResource::class, ['parent_id' => $item->getKey(), 'type' => 'picture'])
 *
 * Only the keys {@see PrefillsCreateFormFromQuery}
 * knows how to resolve are accepted; anything else throws, so a relation
 * manager can never hand-write a query string this trait won't understand.
 * The target Create page still decides, per {@see
 * \App\Filament\Concerns\PrefillsCreateFormFromQuery::queryPrefillFields()},
 * whether it actually accepts a given key — this only guards the master set.
 */
class ResourceCreateUrl
{
    /**
     * The only query-string keys a create page may ever be given. The
     * pre-fill trait reads this same list, so the two can't drift apart.
     *
     * @var array<int, string>
     */
    public const QUERY_KEYS = ['parent_id', 'partner_id', 'type', 'item_id', 'collection_id'];

    /**
     * @param  class-string<\Filament\Resources\Resource>  $resource
     * @param  array<string, scalar>  $parameters
     */
    public static function for(string $resource, array $parameters): string
    {
        $unknown = array_diff(array_keys($parameters), self::QUERY_KEYS);

        if ($unknown !== []) {
            throw new InvalidArgumentException('Unsupported create-page query key(s): '.implode(', ', $unknown));
        }

        return $resource::getUrl('create', $parameters);
    }
}
