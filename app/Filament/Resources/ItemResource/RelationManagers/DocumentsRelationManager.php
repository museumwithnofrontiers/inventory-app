<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Events\DocumentUploadEvent;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\LanguageResource;
use App\Models\DocumentUpload;
use App\Models\Item;
use App\Models\ItemDocument;
use App\Models\Language;
use App\Support\FileSize;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

class DocumentsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'itemDocuments';

    protected static ?string $recordTitleAttribute = 'original_name';

    protected static ?string $title = 'Documents';

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with(['language:id,internal_name']))
            ->defaultSort('display_order', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('original_name')
                    ->label('File name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('title')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('mime_type')
                    ->label('Type')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('size')
                    ->label('Size')
                    ->formatStateUsing(fn (?int $state): string => $state !== null ? FileSize::format($state) : '—')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->url(fn (ItemDocument $record): ?string => $record->language
                        ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                        : null),
                TextColumn::make('display_order')
                    ->label('Order')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->headerActions([
                Action::make('upload')
                    ->label('Upload document')
                    ->icon('heroicon-o-arrow-up-tray')
                    ->visible(fn (): bool => $this->hostRecordCanBeUpdated())
                    ->form([
                        FileUpload::make('file')
                            ->label('Document file')
                            ->disk(Config::string('localstorage.uploads.documents.disk'))
                            ->directory(Config::string('localstorage.uploads.documents.directory'))
                            ->visibility('private')
                            ->storeFileNamesIn('original_filename')
                            ->acceptedFileTypes(explode(',', Config::string('localstorage.uploads.documents.mime')))
                            ->maxSize(Config::integer('localstorage.uploads.documents.max_size'))
                            ->minSize(Config::integer('localstorage.uploads.documents.min_size'))
                            ->required(),
                        Select::make('language_id')
                            ->label('Language')
                            ->searchable()
                            ->getSearchResultsUsing(fn (string $search): array => Language::query()
                                ->where('internal_name', 'like', "%{$search}%")
                                ->orderBy('internal_name')
                                ->limit(50)
                                ->pluck('internal_name', 'id')
                                ->all()
                            )
                            ->getOptionLabelUsing(fn (mixed $value): string => is_string($value) ? (Language::find($value)->internal_name ?? $value) : '')
                            ->nullable(),
                        TextInput::make('title')
                            ->maxLength(255)
                            ->nullable(),
                        TextInput::make('display_order')
                            ->label('Display order')
                            ->numeric()
                            ->integer()
                            ->nullable(),
                    ])
                    ->action(function (array $data): void {
                        $fileRaw = $data['file'] ?? null;
                        $storedPath = is_string($fileRaw) ? $fileRaw : '';
                        $filename = basename($storedPath);
                        $uploadDisk = Config::string('localstorage.uploads.documents.disk');

                        $originalNameRaw = $data['original_filename'] ?? null;
                        $originalName = (is_string($originalNameRaw) && $originalNameRaw !== '') ? $originalNameRaw : $filename;

                        $languageRaw = $data['language_id'] ?? null;
                        $titleRaw = $data['title'] ?? null;
                        $displayOrderRaw = $data['display_order'] ?? null;

                        $documentUpload = DocumentUpload::create([
                            'item_id' => (string) $this->ownerItem()->getKey(),
                            'language_id' => (is_string($languageRaw) && $languageRaw !== '') ? $languageRaw : null,
                            'path' => $filename,
                            'original_name' => $originalName,
                            'mime_type' => Storage::disk($uploadDisk)->mimeType($storedPath) ?: 'application/octet-stream',
                            'size' => (int) Storage::disk($uploadDisk)->size($storedPath),
                            'title' => (is_string($titleRaw) && $titleRaw !== '') ? $titleRaw : null,
                            'display_order' => is_numeric($displayOrderRaw) ? (int) $displayOrderRaw : null,
                            'uploaded_by' => auth()->id() !== null ? (int) auth()->id() : null,
                        ]);

                        DocumentUploadEvent::dispatch($documentUpload);

                        Notification::make()
                            ->success()
                            ->title('Document uploaded')
                            ->body('It is being validated and will appear on this item once processing completes.')
                            ->send();
                    }),
            ])
            ->actions([
                DeleteAction::make(),
            ]);
    }

    private function ownerItem(): Item
    {
        /** @var Item $item */
        $item = $this->getOwnerRecord();

        return $item;
    }
}
