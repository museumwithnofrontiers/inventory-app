<?php

namespace App\Filament\Resources;

use Filament\Schemas\Schema;
use Filament\Schemas\Components\Section;
use Filament\Actions\Action;
use Filament\Actions\ViewAction;
use Filament\Actions\EditAction;
use Filament\Actions\DeleteAction;
use App\Events\ImageUploadEvent;
use App\Filament\Resources\AvailableImageResource\Pages\EditAvailableImage;
use App\Filament\Resources\AvailableImageResource\Pages\ListAvailableImage;
use App\Filament\Resources\AvailableImageResource\Pages\ViewAvailableImage;
use App\Filament\Support\MarkdownState;
use App\Models\AvailableImage;
use App\Models\ImageUpload;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\ImageEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

class AvailableImageResource extends Resource
{
    protected static ?string $model = AvailableImage::class;

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-photo';

    protected static string | \UnitEnum | null $navigationGroup = 'Available Images';

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'path';

    public static function getGloballySearchableAttributes(): array
    {
        return ['path', 'original_name', 'comment'];
    }

    public static function canViewAny(): bool
    {
        return auth()->user()?->can('viewAny', static::getModel()) ?? false;
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canViewAny();
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('comment')
                    ->label('Comment / Alt text')
                    ->maxLength(255)
                    ->nullable(),
                TextInput::make('copyright')
                    ->label('Burned on the picture')
                    ->helperText('Leave blank to inherit from the owning project, or the site-wide default, once attached.')
                    ->maxLength(500)
                    ->nullable()
                    ->dehydrateStateUsing(fn (?string $state): ?string => filled($state) ? $state : null),
                TextInput::make('credit')
                    ->label('Picture credit')
                    ->helperText('The picture\'s own credit where it is not the text burned on it. The sheets print it instead.')
                    ->maxLength(500)
                    ->nullable()
                    ->dehydrateStateUsing(fn (?string $state): ?string => filled($state) ? $state : null),
                TextInput::make('photographer')
                    ->label('Photographer')
                    ->maxLength(255)
                    ->nullable()
                    ->dehydrateStateUsing(fn (?string $state): ?string => filled($state) ? $state : null),
            ]);
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->inlineLabel()
            ->components([
                ImageEntry::make('preview')
                    ->label('Preview')
                    ->getStateUsing(fn (AvailableImage $record) => route('filament.admin.available-image.view', [
                        'availableImage' => $record->id,
                    ]))
                    ->height(200)
                    ->columnSpanFull(),
                Section::make('Image Details')
                    ->schema([
                        TextEntry::make('original_name')
                            ->label('Original name'),
                        TextEntry::make('mime_type')
                            ->label('MIME type'),
                        TextEntry::make('size')
                            ->label('Size (bytes)')
                            ->numeric(),
                        TextEntry::make('comment')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Comment / Alt text'),
                        TextEntry::make('copyright')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Burned on the picture')
                            ->placeholder('Inherited once attached'),
                        TextEntry::make('credit')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Picture credit')
                            ->placeholder('—'),
                        TextEntry::make('photographer')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Photographer')
                            ->placeholder('—'),
                    ])
                    ->columns(2),
                Section::make('System Information')
                    ->schema([
                        TextEntry::make('id')
                            ->label('UUID')
                            ->copyable(),
                        TextEntry::make('path')
                            ->label('Filename'),
                        TextEntry::make('created_at')
                            ->label('Created')
                            ->dateTime(),
                        TextEntry::make('updated_at')
                            ->label('Updated')
                            ->dateTime(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (AvailableImage $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->defaultSort('created_at', 'desc')
            ->columns([
                ImageColumn::make('preview')
                    ->label('Preview')
                    ->getStateUsing(fn (AvailableImage $record) => route('filament.admin.available-image.view', [
                        'availableImage' => $record->id,
                    ]))
                    ->height(64)
                    ->url(fn (AvailableImage $record) => route('filament.admin.available-image.view', [
                        'availableImage' => $record->id,
                    ]))
                    ->openUrlInNewTab()
                    ->defaultImageUrl(null),
                TextColumn::make('path')
                    ->label('Filename')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('original_name')
                    ->label('Original name')
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('mime_type')
                    ->label('MIME type')
                    ->toggleable(),
                TextColumn::make('size')
                    ->label('Size (bytes)')
                    ->numeric()
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('comment')
                    ->label('Comment')
                    ->formatStateUsing(MarkdownState::excerpt(50))
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('id')
                    ->label('UUID')
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(),
            ])
            ->headerActions([
                Action::make('upload')
                    ->label('Upload image')
                    ->icon('heroicon-o-arrow-up-tray')
                    ->visible(fn (): bool => auth()->user()?->can('create', ImageUpload::class) ?? false)
                    ->authorize(fn (): bool => auth()->user()?->can('create', ImageUpload::class) ?? false)
                    ->schema([
                        FileUpload::make('file')
                            ->label('Image file')
                            ->disk('local')
                            ->directory(Config::string('localstorage.uploads.images.directory'))
                            ->visibility('private')
                            ->image()
                            ->acceptedFileTypes(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
                            ->maxSize(Config::integer('localstorage.uploads.images.max_size'))
                            ->required(),
                    ])
                    ->action(function (array $data): void {
                        $fileRaw = $data['file'] ?? null;
                        $path = is_string($fileRaw) ? $fileRaw : '';

                        $imageUpload = ImageUpload::create([
                            'path' => $path,
                            'name' => basename($path),
                            'extension' => pathinfo($path, PATHINFO_EXTENSION),
                            'mime_type' => null,
                            'size' => null,
                        ]);

                        ImageUploadEvent::dispatch($imageUpload);

                        $availableImage = AvailableImage::find($imageUpload->id);

                        if ($availableImage) {
                            Notification::make()
                                ->success()
                                ->title('Image uploaded and available')
                                ->send();
                        } else {
                            Notification::make()
                                ->danger()
                                ->title('Image processing failed')
                                ->body('The uploaded file could not be processed as a valid image. It has not been added to the available image pool.')
                                ->send();
                        }
                    }),
            ])
            ->recordActions([
                Action::make('view_image')
                    ->label('View image')
                    ->icon('heroicon-o-eye')
                    ->color('gray')
                    ->url(fn (AvailableImage $record) => route('filament.admin.available-image.view', [
                        'availableImage' => $record->id,
                    ]))
                    ->openUrlInNewTab(),
                Action::make('download')
                    ->label('Download')
                    ->icon('heroicon-o-arrow-down-tray')
                    ->color('gray')
                    ->url(fn (AvailableImage $record) => route('filament.admin.available-image.download', [
                        'availableImage' => $record->id,
                    ])),
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make()
                    ->before(function (AvailableImage $record): void {
                        $disk = $record->imageDisk();
                        $path = $record->imageStoragePath();

                        if (Storage::disk($disk)->exists($path)) {
                            Storage::disk($disk)->delete($path);
                        }
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListAvailableImage::route('/'),
            'view' => ViewAvailableImage::route('/{record}'),
            'edit' => EditAvailableImage::route('/{record}/edit'),
        ];
    }
}
