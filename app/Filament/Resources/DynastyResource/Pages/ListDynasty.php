<?php

namespace App\Filament\Resources\DynastyResource\Pages;

use App\Filament\Resources\DynastyResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListDynasty extends ListRecords
{
    protected static string $resource = DynastyResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
