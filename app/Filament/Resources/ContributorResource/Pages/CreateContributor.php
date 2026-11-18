<?php

namespace App\Filament\Resources\ContributorResource\Pages;

use App\Filament\Concerns\PrefillsCreateFormFromQuery;
use App\Filament\Resources\ContributorResource;
use App\Models\Collection;
use App\Models\Contributor;
use App\Policies\ContributorPolicy;
use Filament\Resources\Pages\CreateRecord;

/**
 * Accepts `collection_id` from the Collection's ContributorsRelationManager
 * header `Create` action, via {@see PrefillsCreateFormFromQuery}. Saving
 * checks `update` on the collection chosen ({@see ContributorPolicy}).
 */
class CreateContributor extends CreateRecord
{
    use PrefillsCreateFormFromQuery;

    protected static string $resource = ContributorResource::class;

    /**
     * @return array<string, class-string>
     */
    protected function queryPrefillFields(): array
    {
        return [
            'collection_id' => Collection::class,
        ];
    }

    protected function beforeCreate(): void
    {
        $collectionId = $this->data['collection_id'] ?? null;
        $collection = is_string($collectionId) ? Collection::find($collectionId) : null;

        abort_unless(
            $collection !== null && (auth()->user()?->can('create', [Contributor::class, $collection]) ?? false),
            403
        );
    }
}
