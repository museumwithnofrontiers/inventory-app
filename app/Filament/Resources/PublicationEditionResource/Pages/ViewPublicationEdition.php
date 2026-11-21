<?php

namespace App\Filament\Resources\PublicationEditionResource\Pages;

use App\Filament\Resources\PublicationEditionResource;
use App\Filament\Resources\PublicationResource;
use App\Models\PublicationEdition;
use Filament\Actions\Action;
use Filament\Resources\Pages\ViewRecord;

class ViewPublicationEdition extends ViewRecord
{
    protected static string $resource = PublicationEditionResource::class;

    private function edition(): PublicationEdition
    {
        /** @var PublicationEdition $record */
        $record = $this->getRecord();

        return $record;
    }

    /**
     * An edition has no list of its own: it is reached from its publication.
     *
     * @return array<int|string, string>
     */
    public function getBreadcrumbs(): array
    {
        $publication = $this->edition()->publication;
        if ($publication === null || ! (auth()->user()?->can('view', $publication) ?? false)) {
            return ['Edition'];
        }

        return [
            PublicationResource::getUrl('index') => PublicationResource::getBreadcrumb(),
            PublicationResource::getUrl('view', ['record' => $publication]) => (string) PublicationResource::getRecordTitle($publication),
            'Edition',
        ];
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('viewParentPublication')
                ->label('View publication')
                ->icon('heroicon-o-book-open')
                ->url(fn (): ?string => $this->edition()->publication
                    ? PublicationResource::getUrl('view', ['record' => $this->edition()->publication])
                    : null)
                ->visible(fn (): bool => $this->edition()->publication !== null
                    && (auth()->user()?->can('view', $this->edition()->publication) ?? false)),
        ];
    }
}
