<?php

namespace App\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasPlainTextRecordTitle;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\ArtistResource\Pages\CreateArtist;
use App\Filament\Resources\ArtistResource\Pages\EditArtist;
use App\Filament\Resources\ArtistResource\Pages\ListArtist;
use App\Filament\Resources\ArtistResource\Pages\ViewArtist;
use App\Filament\Resources\ArtistResource\RelationManagers\ItemsRelationManager;
use App\Filament\Support\MarkdownState;
use App\Models\Artist;
use App\Policies\ArtistPolicy;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Infolists\Components\Section as InfolistSection;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\Resource;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * The artists items are linked to (the item's "Origin" tab). An artist is
 * shared data, managed with `manage-reference-data` like tags and authors
 * ({@see ArtistPolicy}).
 *
 * Under ADR 006 an item's artist line is display text, kept as written in
 * its translations, next to these links. Nothing here rebuilds that text from
 * an artist, or creates an artist from it.
 */
class ArtistResource extends Resource
{
    use HasBackwardCompatibilityColumn;
    use HasInternalNameColumn;
    use HasPlainTextRecordTitle;
    use HasTimestampsColumns;
    use HasUuidColumn;

    protected static ?string $model = Artist::class;

    protected static ?string $navigationIcon = 'heroicon-o-paint-brush';

    protected static ?string $navigationGroup = 'Shared Data';

    protected static ?int $navigationSort = 5;

    protected static ?string $recordTitleAttribute = 'name';

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'name', 'internal_name', 'backward_compatibility'];
    }

    public static function canViewAny(): bool
    {
        return auth()->user()?->hasPermissionTo(Permission::MANAGE_REFERENCE_DATA->value) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canViewAny();
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Core information')
                    ->schema([
                        TextInput::make('name')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('period_of_activity')
                            ->label('Period of activity')
                            ->maxLength(255)
                            ->nullable(),
                        TextInput::make('place_of_birth')
                            ->label('Place of birth')
                            ->maxLength(255)
                            ->nullable(),
                        TextInput::make('date_of_birth')
                            ->label('Date of birth')
                            ->maxLength(255)
                            ->nullable(),
                        TextInput::make('place_of_death')
                            ->label('Place of death')
                            ->maxLength(255)
                            ->nullable(),
                        TextInput::make('date_of_death')
                            ->label('Date of death')
                            ->maxLength(255)
                            ->nullable(),
                    ])
                    ->columns(2),
                Section::make('Technical identification')
                    ->description('System metadata used for technical identification and legacy imports.')
                    ->schema([
                        TextInput::make('internal_name')
                            ->required()
                            ->maxLength(255)
                            ->unique(ignoreRecord: true),
                        TextInput::make('backward_compatibility')
                            ->label('Legacy code')
                            ->maxLength(255)
                            ->nullable(),
                    ])
                    ->columns(2)
                    ->collapsed(fn (?Artist $record): bool => $record !== null),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (Artist $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->withCount('items'))
            ->defaultSort('name', 'asc')
            ->columns([
                TextColumn::make('name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->searchable()
                    ->sortable(),
                TextColumn::make('period_of_activity')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Period of activity')
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('date_of_birth')
                    ->label('Born')
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('date_of_death')
                    ->label('Died')
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('items_count')
                    ->label('Items')
                    ->sortable(),
                static::internalNameColumn()
                    ->toggleable(isToggledHiddenByDefault: true),
                static::backwardCompatibilityColumn(),
                static::uuidColumn(),
                ...static::timestampsColumns(),
            ])
            ->actions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make()
                    ->modalDescription(fn (Artist $record): string => static::deleteConfirmation($record)),
            ]);
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->inlineLabel()
            ->schema([
                InfolistSection::make('Core Information')
                    ->schema([
                        TextEntry::make('name')->formatStateUsing(MarkdownState::inline()),
                        TextEntry::make('period_of_activity')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Period of activity')
                            ->placeholder('—'),
                        TextEntry::make('place_of_birth')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Place of birth')
                            ->placeholder('—'),
                        TextEntry::make('date_of_birth')
                            ->label('Date of birth')
                            ->placeholder('—'),
                        TextEntry::make('place_of_death')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Place of death')
                            ->placeholder('—'),
                        TextEntry::make('date_of_death')
                            ->label('Date of death')
                            ->placeholder('—'),
                    ])
                    ->columns(2),
                InfolistSection::make('System Information')
                    ->schema([
                        static::uuidInfolistEntry(),
                        TextEntry::make('internal_name')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Internal name'),
                        TextEntry::make('backward_compatibility')
                            ->label('Legacy code')
                            ->placeholder('—'),
                        ...static::timestampsInfolistEntries(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),
            ]);
    }

    /**
     * Deleting an artist removes its links to items (the artist_item rows
     * cascade); the items stay, and so do their artist lines, which are text
     * of their own (ADR 006). The confirmation says how many links go.
     */
    public static function deleteConfirmation(Artist $record): string
    {
        $count = $record->items()->count();

        if ($count === 0) {
            return 'This artist is not linked to any item.';
        }

        return trans_choice(
            'This artist is linked to :count item. Deleting it removes that link; the item and its artist line stay.|This artist is linked to :count items. Deleting it removes those links; the items and their artist lines stay.',
            $count,
            ['count' => $count],
        );
    }

    public static function getRelations(): array
    {
        return [
            ItemsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListArtist::route('/'),
            'create' => CreateArtist::route('/create'),
            'edit' => EditArtist::route('/{record}/edit'),
            'view' => ViewArtist::route('/{record}'),
        ];
    }
}
