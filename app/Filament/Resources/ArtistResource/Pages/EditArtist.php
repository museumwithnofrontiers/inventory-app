<?php

namespace App\Filament\Resources\ArtistResource\Pages;

use App\Filament\Concerns\RedirectsToViewAfterSave;
use App\Filament\Resources\ArtistResource;
use App\Models\Artist;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditArtist extends EditRecord
{
    use RedirectsToViewAfterSave;

    protected static string $resource = ArtistResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make()
                ->modalDescription(fn (Artist $record): string => ArtistResource::deleteConfirmation($record)),
        ];
    }
}
