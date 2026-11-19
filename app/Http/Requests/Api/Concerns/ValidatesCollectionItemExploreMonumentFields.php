<?php

namespace App\Http\Requests\Api\Concerns;

/**
 * The rules the Store and Update requests of a placement's Explore monuments
 * share (M16 C4). Everything is optional and kept as written.
 */
trait ValidatesCollectionItemExploreMonumentFields
{
    /**
     * @return array<string, array<int, string>>
     */
    protected function exploreMonumentRules(): array
    {
        return [
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'map_zoom' => ['nullable', 'integer', 'between:0,22'],
            'location_collection_id' => ['nullable', 'uuid', 'exists:collections,id'],
            'description_types' => ['nullable', 'string', 'max:255'],
            'travels_description_ref' => ['nullable', 'string', 'max:255'],
            'explore_description_ref' => ['nullable', 'string', 'max:255'],
            'virtual_museum_description_ref' => ['nullable', 'string', 'max:255'],
            'partner_ids' => ['sometimes', 'nullable', 'array'],
            'partner_ids.*' => ['uuid', 'distinct', 'exists:partners,id'],
        ];
    }
}
