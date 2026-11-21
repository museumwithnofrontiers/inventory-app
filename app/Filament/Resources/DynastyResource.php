<?php

namespace App\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\DynastyResource\Pages\CreateDynasty;
use App\Filament\Resources\DynastyResource\Pages\EditDynasty;
use App\Filament\Resources\DynastyResource\Pages\ListDynasty;
use App\Filament\Resources\DynastyResource\Pages\ViewDynasty;
use App\Filament\Resources\DynastyResource\RelationManagers\ItemsRelationManager;
use App\Filament\Resources\DynastyResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Support\DynastyDisplayLabel;
use App\Filament\Support\MarkdownState;
use App\Models\Dynasty;
use App\Policies\DynastyPolicy;
use App\Support\Markdown\MarkdownText;
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
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * The dynasties items are linked to (the item's "Origin" tab). A dynasty is
 * shared data, managed with `manage-reference-data` like tags and authors
 * ({@see DynastyPolicy}). Its names, area, history and date
 * texts live in its translations, one per language, edited in the
 * Translations manager.
 *
 * Under ADR 006 an item's dynasty line is display text, kept as written in
 * its translations, next to these links. Nothing here rebuilds that text from
 * a dynasty, or creates a dynasty from it.
 */
class DynastyResource extends Resource
{
    use HasBackwardCompatibilityColumn;
    use HasTimestampsColumns;
    use HasUuidColumn;

    protected static ?string $model = Dynasty::class;

    protected static ?string $navigationIcon = 'heroicon-o-flag';

    protected static ?string $navigationGroup = 'Shared Data';

    protected static ?int $navigationSort = 6;

    protected static ?string $modelLabel = 'dynasty';

    protected static ?string $pluralModelLabel = 'dynasties';

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'backward_compatibility', 'translations.name'];
    }

    /**
     * @return Builder<Dynasty>
     */
    public static function getGlobalSearchEloquentQuery(): Builder
    {
        return parent::getGlobalSearchEloquentQuery()->with('translations');
    }

    /**
     * A dynasty has no name column: its title is the name of its translation
     * in the default language, else in any language, else its legacy code
     * ({@see DynastyDisplayLabel}).
     */
    public static function hasRecordTitle(): bool
    {
        return true;
    }

    public static function getRecordTitle(?Model $record): string|Htmlable|null
    {
        if (! $record instanceof Dynasty) {
            return parent::getRecordTitle($record);
        }

        $label = MarkdownText::plain(DynastyDisplayLabel::resolveForRecord($record));

        return $label !== '' ? $label : (string) $record->getKey();
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
                Section::make('Dates')
                    ->description('The dynasty\'s names, area, history and date texts are in its translations.')
                    ->schema([
                        TextInput::make('from_ad')
                            ->label('From (AD)')
                            ->numeric()
                            ->integer()
                            ->nullable(),
                        TextInput::make('to_ad')
                            ->label('To (AD)')
                            ->numeric()
                            ->integer()
                            ->nullable(),
                        TextInput::make('from_ah')
                            ->label('From (AH)')
                            ->numeric()
                            ->integer()
                            ->nullable(),
                        TextInput::make('to_ah')
                            ->label('To (AH)')
                            ->numeric()
                            ->integer()
                            ->nullable(),
                    ])
                    ->columns(2),
                Section::make('Technical identification')
                    ->description('System metadata used for technical identification and legacy imports.')
                    ->schema([
                        TextInput::make('backward_compatibility')
                            ->label('Legacy code')
                            ->maxLength(255)
                            ->nullable(),
                    ])
                    ->collapsed(fn (?Dynasty $record): bool => $record !== null),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (Dynasty $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->modifyQueryUsing(fn (Builder $query): Builder => DynastyDisplayLabel::withDisplayLabel($query)->withCount(['items', 'translations']))
            ->defaultSort('from_ad', 'asc')
            ->columns([
                TextColumn::make('display_label')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Name')
                    ->searchable(query: fn (Builder $query, string $search): Builder => $query->whereHas(
                        'translations',
                        fn (Builder $translations): Builder => $translations->where('name', 'like', "%{$search}%")
                    ))
                    ->sortable(query: fn (Builder $query, string $direction): Builder => $query->orderBy('display_label', $direction)),
                TextColumn::make('from_ad')
                    ->label('From (AD)')
                    ->sortable(),
                TextColumn::make('to_ad')
                    ->label('To (AD)')
                    ->sortable(),
                TextColumn::make('from_ah')
                    ->label('From (AH)')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('to_ah')
                    ->label('To (AH)')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('translations_count')
                    ->label('Translations')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('items_count')
                    ->label('Items')
                    ->sortable(),
                static::backwardCompatibilityColumn(),
                static::uuidColumn(),
                ...static::timestampsColumns(),
            ])
            ->actions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make()
                    ->modalDescription(fn (Dynasty $record): string => static::deleteConfirmation($record)),
            ]);
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->inlineLabel()
            ->schema([
                InfolistSection::make('Core Information')
                    ->schema([
                        TextEntry::make('display_label')
                            ->label('Name')
                            ->state(fn (Dynasty $record): string => DynastyDisplayLabel::resolveForRecord($record))
                            ->formatStateUsing(MarkdownState::inline())
                            ->placeholder('—'),
                        TextEntry::make('from_ad')
                            ->label('From (AD)')
                            ->placeholder('—'),
                        TextEntry::make('to_ad')
                            ->label('To (AD)')
                            ->placeholder('—'),
                        TextEntry::make('from_ah')
                            ->label('From (AH)')
                            ->placeholder('—'),
                        TextEntry::make('to_ah')
                            ->label('To (AH)')
                            ->placeholder('—'),
                    ])
                    ->columns(2),
                InfolistSection::make('System Information')
                    ->schema([
                        static::uuidInfolistEntry(),
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
     * Deleting a dynasty removes its translations and its links to items (the
     * dynasty_translations and item_dynasty rows cascade); the items stay, and
     * so do their dynasty lines, which are text of their own (ADR 006). The
     * confirmation says how many links go.
     */
    public static function deleteConfirmation(Dynasty $record): string
    {
        $count = $record->items()->count();

        if ($count === 0) {
            return 'This dynasty is not linked to any item. Its translations are deleted with it.';
        }

        return trans_choice(
            'This dynasty is linked to :count item. Deleting it removes that link and its translations; the item and its dynasty line stay.|This dynasty is linked to :count items. Deleting it removes those links and its translations; the items and their dynasty lines stay.',
            $count,
            ['count' => $count],
        );
    }

    public static function getRelations(): array
    {
        return [
            TranslationsRelationManager::class,
            ItemsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListDynasty::route('/'),
            'create' => CreateDynasty::route('/create'),
            'edit' => EditDynasty::route('/{record}/edit'),
            'view' => ViewDynasty::route('/{record}'),
        ];
    }
}
