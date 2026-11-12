<?php

namespace App\Filament\Resources\PublicationResource\RelationManagers;

use App\Enums\PublicationImageKind;
use App\Filament\Resources\RelationManagers\BaseImagesRelationManager;
use App\Models\AvailableImage;
use App\Models\Publication;
use App\Models\PublicationEdition;
use App\Models\PublicationImage;
use Filament\Forms\Components\Select;
use Filament\Tables\Columns\TextColumn;

/**
 * A publication's covers and sample pages. Attach takes an AvailableImage
 * through PublicationImage::attachFromAvailableImage(), never an upload.
 */
class ImagesRelationManager extends BaseImagesRelationManager
{
    protected static string $relationship = 'publicationImages';

    protected function imageModelClass(): string
    {
        return PublicationImage::class;
    }

    protected function ownerForeignKey(): string
    {
        return 'publication_id';
    }

    protected function ownerRouteParameter(): string
    {
        return 'publication';
    }

    protected function imageRouteParameter(): string
    {
        return 'publicationImage';
    }

    protected function imageViewRouteName(): string
    {
        return 'filament.admin.publication-image.view';
    }

    protected function imageDownloadRouteName(): string
    {
        return 'filament.admin.publication-image.download';
    }

    protected function extraImageFormFields(): array
    {
        return [
            Select::make('kind')
                ->label('Kind')
                ->options(PublicationImageKind::options())
                ->default(PublicationImageKind::PAGE->value)
                ->required(),
            // A publication has a handful of editions: a plain select of its own
            Select::make('publication_edition_id')
                ->label('Cover of edition')
                ->options(fn (): array => $this->editionOptions())
                ->nullable(),
        ];
    }

    protected function extraImageColumns(): array
    {
        return [
            TextColumn::make('kind')
                ->badge()
                ->formatStateUsing(fn (?PublicationImageKind $state): ?string => $state?->label())
                ->sortable(),
            TextColumn::make('publicationEdition.backward_compatibility')
                ->label('Edition')
                ->placeholder('—')
                ->toggleable(isToggledHiddenByDefault: true),
        ];
    }

    protected function attachAvailableImage(AvailableImage $availableImage, string $ownerKey, ?string $altText, array $data): void
    {
        $kind = $data['kind'] ?? null;
        $edition = $data['publication_edition_id'] ?? null;

        PublicationImage::attachFromAvailableImage(
            $availableImage,
            $ownerKey,
            $altText,
            is_string($kind) ? PublicationImageKind::from($kind) : PublicationImageKind::PAGE,
            is_string($edition) && $edition !== '' ? $edition : null,
        );
    }

    /**
     * @return array<string, string>
     */
    private function editionOptions(): array
    {
        /** @var Publication $publication */
        $publication = $this->getOwnerRecord();

        return $publication->editions()
            ->orderBy('display_order')
            ->get()
            ->mapWithKeys(fn (PublicationEdition $edition): array => [
                $edition->id => trim(implode(' ', array_filter([
                    $edition->language_id,
                    $edition->format->label(),
                    $edition->edition !== null ? '#'.$edition->edition : null,
                    $edition->publish_year !== null ? (string) $edition->publish_year : null,
                ]))),
            ])
            ->all();
    }
}
