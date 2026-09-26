<?php

namespace App\Filament\Resources\ItemResource\Pages;

use App\Enums\ItemType;
use App\Filament\Concerns\PrefillsCreateFormFromQuery;
use App\Filament\Resources\ItemResource;
use App\Models\Item;
use App\Models\Partner;
use Filament\Resources\Pages\CreateRecord;

class CreateItem extends CreateRecord
{
    use PrefillsCreateFormFromQuery;

    protected static string $resource = ItemResource::class;

    /**
     * @return array<string, class-string>
     */
    protected function queryPrefillFields(): array
    {
        return [
            'parent_id' => Item::class,
            'partner_id' => Partner::class,
            'type' => ItemType::class,
        ];
    }
}
