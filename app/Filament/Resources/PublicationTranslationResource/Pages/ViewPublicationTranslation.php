<?php

namespace App\Filament\Resources\PublicationTranslationResource\Pages;

use App\Filament\Resources\PublicationResource;
use App\Filament\Resources\PublicationTranslationResource;
use App\Models\PublicationTranslation;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Resources\Pages\ViewRecord;

class ViewPublicationTranslation extends ViewRecord
{
    protected static string $resource = PublicationTranslationResource::class;

    private function translationRecord(): PublicationTranslation
    {
        /** @var PublicationTranslation $record */
        $record = $this->getRecord();

        return $record;
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('viewParentPublication')
                ->label('View parent publication')
                ->icon('heroicon-o-book-open')
                ->url(fn (): ?string => $this->translationRecord()->publication
                    ? (auth()->user()?->can('view', $this->translationRecord()->publication)
                        ? PublicationResource::getUrl('view', ['record' => $this->translationRecord()->publication])
                        : null)
                    : null)
                ->visible(fn (): bool => $this->translationRecord()->publication !== null
                    && (auth()->user()?->can('view', $this->translationRecord()->publication) ?? false)),
            EditAction::make(),
            DeleteAction::make(),
        ];
    }
}
