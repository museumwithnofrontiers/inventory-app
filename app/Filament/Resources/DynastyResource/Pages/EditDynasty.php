<?php

namespace App\Filament\Resources\DynastyResource\Pages;

use App\Filament\Concerns\RedirectsToViewAfterSave;
use App\Filament\Resources\DynastyResource;
use App\Models\Dynasty;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditDynasty extends EditRecord
{
    use RedirectsToViewAfterSave;

    protected static string $resource = DynastyResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make()
                ->modalDescription(fn (Dynasty $record): string => DynastyResource::deleteConfirmation($record)),
        ];
    }
}
