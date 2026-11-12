<?php

namespace App\Filament\Resources\RelationManagers;

use App\Contracts\DetachableImage;
use App\Contracts\StreamableImageFile;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Models\AvailableImage;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Columns\Column;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

abstract class BaseImagesRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static ?string $recordTitleAttribute = 'path';

    protected static ?string $title = 'Images';

    protected function canCreate(): bool
    {
        return false;
    }

    protected function canDeleteAny(): bool
    {
        return false;
    }

    abstract protected function imageModelClass(): string;

    abstract protected function ownerForeignKey(): string;

    abstract protected function ownerRouteParameter(): string;

    abstract protected function imageRouteParameter(): string;

    abstract protected function imageViewRouteName(): string;

    abstract protected function imageDownloadRouteName(): string;

    /**
     * Fields an image model needs on top of the shared ones, appended to
     * both the attach and the edit form (PublicationImage: its kind and
     * edition). None by default.
     *
     * @return array<int, Component>
     */
    protected function extraImageFormFields(): array
    {
        return [];
    }

    /**
     * Columns an image model shows on top of the shared ones, after the
     * filename. None by default.
     *
     * @return array<int, Column>
     */
    protected function extraImageColumns(): array
    {
        return [];
    }

    /**
     * Attaches the chosen AvailableImage through the model's own
     * attachFromAvailableImage() row swap. A model whose attach takes more
     * than the owner and the alt text (PublicationImage) reads the rest
     * from the attach form's $data.
     *
     * @param  array<string, mixed>  $data
     */
    protected function attachAvailableImage(AvailableImage $availableImage, string $ownerKey, ?string $altText, array $data): void
    {
        $modelClass = $this->imageModelClass();
        $modelClass::attachFromAvailableImage($availableImage, $ownerKey, $altText);
    }

    public function table(Table $table): Table
    {
        return $table
            ->defaultSort('display_order', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                ImageColumn::make('preview')
                    ->label('Preview')
                    ->getStateUsing(fn (Model $record): string => route($this->imageViewRouteName(), $this->imageRouteParameters($record)))
                    ->height(64)
                    ->url(fn (Model $record): string => route($this->imageViewRouteName(), $this->imageRouteParameters($record)))
                    ->openUrlInNewTab()
                    ->defaultImageUrl(null),
                TextColumn::make('path')
                    ->label('Filename')
                    ->searchable()
                    ->sortable(),
                ...$this->extraImageColumns(),
                TextColumn::make('alt_text')
                    ->label('Alt text')
                    ->limit(50)
                    ->toggleable(),
                TextColumn::make('display_order')
                    ->label('Order')
                    ->sortable(),
                TextColumn::make('mime_type')
                    ->label('Type')
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('size')
                    ->label('Size (bytes)')
                    ->numeric()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('created_at')
                    ->label('Attached')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->headerActions([
                Action::make('attach')
                    ->label('Attach image')
                    ->icon('heroicon-o-paper-clip')
                    ->visible(fn (): bool => $this->hostRecordCanBeUpdated())
                    ->form([
                        Select::make('available_image_id')
                            ->label('Available image')
                            ->required()
                            ->getSearchResultsUsing(fn (string $search): array => AvailableImage::query()
                                ->where('path', 'like', "%{$search}%")
                                ->orWhere('original_name', 'like', "%{$search}%")
                                ->orWhere('comment', 'like', "%{$search}%")
                                ->orderBy('created_at', 'desc')
                                ->limit(50)
                                ->get()
                                ->mapWithKeys(fn (AvailableImage $img): array => [
                                    $img->id => $img->path.($img->comment ? ' — '.$img->comment : ''),
                                ])
                                ->all()
                            )
                            ->getOptionLabelUsing(fn (mixed $value): string => is_string($value) ? (AvailableImage::find($value)->path ?? $value) : '')
                            ->searchable(),
                        TextInput::make('alt_text')
                            ->label('Alt text')
                            ->maxLength(255)
                            ->nullable(),
                        ...$this->extraImageFormFields(),
                    ])
                    ->action(function (array $data): void {
                        $availableImage = AvailableImage::find($data['available_image_id']);

                        if (! $availableImage) {
                            Notification::make()
                                ->danger()
                                ->title('Image not found')
                                ->body('The selected image is no longer available.')
                                ->send();

                            return;
                        }

                        $ownerKey = $this->getOwnerRecord()->getKey();
                        $altTextRaw = $data['alt_text'] ?? null;
                        /** @var array<string, mixed> $data */
                        $this->attachAvailableImage(
                            $availableImage,
                            is_scalar($ownerKey) ? (string) $ownerKey : '',
                            is_string($altTextRaw) ? $altTextRaw : null,
                            $data
                        );

                        Notification::make()
                            ->success()
                            ->title('Image attached')
                            ->send();
                    }),
            ])
            ->actions([
                Action::make('view_image')
                    ->label('View image')
                    ->icon('heroicon-o-eye')
                    ->color('gray')
                    ->url(fn (Model $record): string => route($this->imageViewRouteName(), $this->imageRouteParameters($record)))
                    ->openUrlInNewTab(),
                Action::make('download')
                    ->label('Download')
                    ->icon('heroicon-o-arrow-down-tray')
                    ->color('gray')
                    ->url(fn (Model $record): string => route($this->imageDownloadRouteName(), $this->imageRouteParameters($record))),
                EditAction::make()
                    ->form([
                        TextInput::make('alt_text')
                            ->label('Alt text')
                            ->maxLength(255)
                            ->nullable(),
                        TextInput::make('display_order')
                            ->label('Display order')
                            ->numeric()
                            ->integer()
                            ->nullable(),
                        TextInput::make('copyright')
                            ->label('Copyright')
                            ->helperText('Leave blank to inherit from the owning project, or the site-wide default.')
                            ->maxLength(500)
                            ->nullable()
                            ->dehydrateStateUsing(fn (?string $state): ?string => filled($state) ? $state : null),
                        ...$this->extraImageFormFields(),
                    ]),
                Action::make('detach')
                    ->label('Detach')
                    ->icon('heroicon-o-arrow-path')
                    ->color('warning')
                    ->visible(fn (): bool => $this->hostRecordCanBeUpdated())
                    ->requiresConfirmation()
                    ->modalHeading('Detach image')
                    ->modalDescription('This will move the image back to the available image pool. You can re-attach it later.')
                    ->action(function (Model $record): void {
                        /** @var Model&StreamableImageFile&DetachableImage $record */
                        $record->detachToAvailableImage();

                        Notification::make()
                            ->success()
                            ->title('Image detached and returned to pool')
                            ->send();
                    }),
                DeleteAction::make()
                    ->label('Delete permanently')
                    ->requiresConfirmation()
                    ->modalHeading('Delete image permanently')
                    ->modalDescription('The image file will be permanently deleted from storage and cannot be recovered. It will NOT be returned to the available image pool.'),
            ]);
    }

    /**
     * @return array<string, string>
     */
    protected function imageRouteParameters(Model $record): array
    {
        $ownerAttr = $record->getAttribute($this->ownerForeignKey());
        $imageKey = $record->getKey();

        return [
            $this->ownerRouteParameter() => is_scalar($ownerAttr) ? (string) $ownerAttr : '',
            $this->imageRouteParameter() => is_scalar($imageKey) ? (string) $imageKey : '',
        ];
    }
}
