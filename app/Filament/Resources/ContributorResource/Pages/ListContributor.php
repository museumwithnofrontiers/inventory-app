<?php

namespace App\Filament\Resources\ContributorResource\Pages;

use App\Filament\Resources\ContributorResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListContributor extends ListRecords
{
    protected static string $resource = ContributorResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
