<?php

namespace App\Filament\Resources\ContributorResource\Pages;

use App\Filament\Resources\ContributorResource;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Resources\Pages\ViewRecord;

class ViewContributor extends ViewRecord
{
    protected static string $resource = ContributorResource::class;

    protected function getHeaderActions(): array
    {
        return [
            EditAction::make(),
            DeleteAction::make(),
        ];
    }
}
