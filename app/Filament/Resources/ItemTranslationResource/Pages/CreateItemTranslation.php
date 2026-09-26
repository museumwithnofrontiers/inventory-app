<?php

namespace App\Filament\Resources\ItemTranslationResource\Pages;

use App\Filament\Concerns\PrefillsCreateFormFromQuery;
use App\Filament\Resources\ItemTranslationResource;
use App\Models\Item;
use Filament\Resources\Pages\CreateRecord;

class CreateItemTranslation extends CreateRecord
{
    use PrefillsCreateFormFromQuery;

    protected static string $resource = ItemTranslationResource::class;

    /**
     * @return array<string, class-string>
     */
    protected function queryPrefillFields(): array
    {
        return [
            'item_id' => Item::class,
        ];
    }
}
