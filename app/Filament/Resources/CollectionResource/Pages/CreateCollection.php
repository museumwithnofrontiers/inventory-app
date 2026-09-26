<?php

namespace App\Filament\Resources\CollectionResource\Pages;

use App\Filament\Concerns\PrefillsCreateFormFromQuery;
use App\Filament\Resources\CollectionResource;
use App\Models\Collection;
use Filament\Resources\Pages\CreateRecord;

class CreateCollection extends CreateRecord
{
    use PrefillsCreateFormFromQuery;

    protected static string $resource = CollectionResource::class;

    /**
     * @return array<string, class-string>
     */
    protected function queryPrefillFields(): array
    {
        return [
            'parent_id' => Collection::class,
        ];
    }
}
