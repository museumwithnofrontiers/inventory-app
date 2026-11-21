<?php

namespace App\Filament\Resources;

use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasPlainTextRecordTitle;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\ContributorResource\Pages\CreateContributor;
use App\Filament\Resources\ContributorResource\Pages\EditContributor;
use App\Filament\Resources\ContributorResource\Pages\ListContributor;
use App\Filament\Resources\ContributorResource\Pages\ViewContributor;
use App\Filament\Resources\ContributorResource\RelationManagers\ImagesRelationManager;
use App\Filament\Resources\ContributorResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\RecordSelect;
use App\Models\Contributor;
use App\Policies\ContributorPolicy;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Form;
use Filament\Infolists\Components\IconEntry;
use Filament\Infolists\Components\Section as InfolistSection;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\Resource;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * The people and partners credited on a collection (M16 I5, #2648): the
 * collection credits the importer moved out of `extra` (author, curated_by,
 * credits, …) and the thematic galleries' contributors. A contributor always
 * belongs to one collection; it is authorized through that collection
 * ({@see ContributorPolicy}).
 */
class ContributorResource extends Resource
{
    use HasBackwardCompatibilityColumn;
    use HasInternalNameColumn;
    use HasPlainTextRecordTitle;
    use HasTimestampsColumns;
    use HasUuidColumn;

    /**
     * The collection credits the packages ship, under these keys, in the
     * collection translation's `extra` (scripts/exporters/shared/credits.mjs).
     */
    public const CREDIT_CATEGORIES = [
        'author' => 'Author',
        'travels_author' => 'Travels author',
        'prepared_by' => 'Prepared by',
        'curated_by' => 'Curated by',
        'credits' => 'Credits',
        'local_coordinator' => 'Local coordinator',
        'local_team' => 'Local team',
        'photo_by' => 'Photo by',
    ];

    protected static ?string $model = Contributor::class;

    protected static ?string $navigationIcon = 'heroicon-o-user-group';

    protected static ?string $navigationGroup = 'Inventory';

    protected static ?int $navigationSort = 10;

    protected static ?string $recordTitleAttribute = 'internal_name';

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'internal_name', 'backward_compatibility'];
    }

    public static function canViewAny(): bool
    {
        return auth()->user()?->can('viewAny', Contributor::class) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canViewAny();
    }

    /**
     * The credit categories, then any other category a contributor already has
     * (the thematic galleries' own), so an existing value is never lost.
     *
     * @return array<string, string>
     */
    public static function categoryOptions(): array
    {
        $options = self::CREDIT_CATEGORIES;

        foreach (Contributor::query()->distinct()->orderBy('category')->pluck('category') as $category) {
            if (is_string($category) && ! array_key_exists($category, $options)) {
                $options[$category] = $category;
            }
        }

        return $options;
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Core information')
                    ->schema([
                        RecordSelect::forCollections(),
                        Select::make('category')
                            ->options(fn (): array => static::categoryOptions())
                            ->required()
                            ->searchable()
                            ->helperText('The collection credits are shipped under their category, in the collection\'s texts.'),
                        TextInput::make('display_order')
                            ->label('Display order')
                            ->numeric()
                            ->integer()
                            ->default(0)
                            ->required(),
                        Toggle::make('visible')
                            ->default(true)
                            ->helperText('A hidden contributor is not exported.'),
                    ])
                    ->columns(2),
                Section::make('Technical identification')
                    ->description('System metadata used for technical identification and legacy imports.')
                    ->schema([
                        TextInput::make('internal_name')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('backward_compatibility')
                            ->label('Legacy code')
                            ->maxLength(255)
                            ->nullable(),
                    ])
                    ->columns(2)
                    ->collapsed(fn (?Contributor $record): bool => $record !== null),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (Contributor $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with('collection:id,internal_name'))
            ->defaultSort('internal_name', 'asc')
            ->columns([
                static::internalNameColumn()
                    ->label('Internal name'),
                TextColumn::make('collection.internal_name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Collection')
                    ->sortable(),
                TextColumn::make('category')
                    ->formatStateUsing(fn (string $state): string => self::CREDIT_CATEGORIES[$state] ?? $state)
                    ->badge()
                    ->sortable(),
                TextColumn::make('display_order')
                    ->label('Order')
                    ->sortable(),
                IconColumn::make('visible')
                    ->boolean(),
                static::backwardCompatibilityColumn(),
                static::uuidColumn(),
                ...static::timestampsColumns(),
            ])
            ->actions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->filters([
                SelectFilter::make('category')
                    ->options(fn (): array => static::categoryOptions()),
            ]);
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->inlineLabel()
            ->schema([
                InfolistSection::make('Core Information')
                    ->schema([
                        TextEntry::make('collection.internal_name')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Collection')
                            ->url(fn (Contributor $record): ?string => auth()->user()?->can('view', $record->collection)
                                ? CollectionResource::getUrl('view', ['record' => $record->collection_id])
                                : null),
                        TextEntry::make('category')
                            ->formatStateUsing(fn (string $state): string => self::CREDIT_CATEGORIES[$state] ?? $state),
                        TextEntry::make('display_order')
                            ->label('Display order'),
                        IconEntry::make('visible')
                            ->boolean(),
                    ])
                    ->columns(2),
                InfolistSection::make('System Information')
                    ->schema([
                        static::uuidInfolistEntry(),
                        TextEntry::make('internal_name')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Internal name'),
                        TextEntry::make('backward_compatibility')
                            ->label('Legacy code'),
                        ...static::timestampsInfolistEntries(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            TranslationsRelationManager::class,
            ImagesRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListContributor::route('/'),
            'create' => CreateContributor::route('/create'),
            'edit' => EditContributor::route('/{record}/edit'),
            'view' => ViewContributor::route('/{record}'),
        ];
    }
}
