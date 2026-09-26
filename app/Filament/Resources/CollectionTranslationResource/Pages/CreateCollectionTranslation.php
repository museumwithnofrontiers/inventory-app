<?php

namespace App\Filament\Resources\CollectionTranslationResource\Pages;

use App\Filament\Concerns\PrefillsCreateFormFromQuery;
use App\Filament\Resources\CollectionTranslationResource;
use App\Models\Collection;
use Filament\Resources\Pages\CreateRecord;

class CreateCollectionTranslation extends CreateRecord
{
    use PrefillsCreateFormFromQuery;

    protected static string $resource = CollectionTranslationResource::class;

    /**
     * @return array<string, class-string>
     */
    protected function queryPrefillFields(): array
    {
        return [
            'collection_id' => Collection::class,
        ];
    }
}
