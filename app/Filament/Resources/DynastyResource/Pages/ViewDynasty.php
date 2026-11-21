<?php

namespace App\Filament\Resources\DynastyResource\Pages;

use App\Filament\Resources\DynastyResource;
use App\Models\Dynasty;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Resources\Pages\ViewRecord;

class ViewDynasty extends ViewRecord
{
    protected static string $resource = DynastyResource::class;

    protected function getHeaderActions(): array
    {
        return [
            EditAction::make(),
            DeleteAction::make()
                ->modalDescription(fn (Dynasty $record): string => DynastyResource::deleteConfirmation($record)),
        ];
    }
}
