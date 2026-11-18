<?php

namespace App\Filament\Resources\ContributorResource\Pages;

use App\Filament\Concerns\RedirectsToViewAfterSave;
use App\Filament\Resources\ContributorResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditContributor extends EditRecord
{
    use RedirectsToViewAfterSave;

    protected static string $resource = ContributorResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
