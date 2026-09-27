<?php

namespace App\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasChangeParentAction;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasLegacyLinksInfolistSection;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasTranslationCoverageFilters;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\CollectionResource\Pages\CreateCollection;
use App\Filament\Resources\CollectionResource\Pages\EditCollection;
use App\Filament\Resources\CollectionResource\Pages\ListCollection;
use App\Filament\Resources\CollectionResource\Pages\ViewCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\ChildCollectionsRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\ImagesRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\ItemsRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\PartnersRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Support\CollectionDisplayLabel;
use App\Filament\Support\ExtraJsonField;
use App\Filament\Support\RecordSelect;
use App\Models\Collection;
use App\Models\Country;
use App\Models\Partner;
use App\Models\Project;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\Section as FiltersSection;
use Filament\Forms\Components\Select;
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
use Filament\Tables\Enums\FiltersLayout;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class CollectionResource extends Resource
{
    use HasBackwardCompatibilityColumn;

    /** @use HasChangeParentAction<Collection> */
    use HasChangeParentAction;

    use HasInternalNameColumn;
    use HasLegacyLinksInfolistSection;
    use HasTimestampsColumns;
    use HasTranslationCoverageFilters;
    use HasUuidColumn;

    private const TYPE_OPTIONS = [
        'collection' => 'Collection',
        'exhibition' => 'Exhibition',
        'gallery' => 'Gallery',
        'theme' => 'Theme',
        'exhibition trail' => 'Exhibition trail',
        'itinerary' => 'Itinerary',
        'location' => 'Location',
        'subtheme' => 'Subtheme',
        'region' => 'Region',
    ];

    private const PURPOSE_OPTIONS = [
        'exhibitions-root' => 'Exhibitions root',
        'artistic-introduction-root' => 'Artistic introduction root',
        'historical-profiles-root' => 'Historical profiles root',
        'historical-background-root' => 'Historical background root',
        'topics-root' => 'Topics root',
        'galleries-root' => 'Galleries root',
        'travels-root' => 'Travels root',
        'explore-themes-root' => 'Explore themes root',
        'explore-countries-root' => 'Explore countries root',
        'explore-itineraries-root' => 'Explore itineraries root',
        'national-context' => 'National context',
    ];

    protected static ?string $model = Collection::class;

    protected static function changeParentModelClass(): string
    {
        return Collection::class;
    }

    protected static function changeParentSelectLabel(): string
    {
        return 'New parent collection';
    }

    protected static function changeParentPluralLabel(): string
    {
        return 'Collections';
    }

    /**
     * @param  Builder<Collection>  $query
     * @return Builder<Collection>
     */
    protected static function changeParentRowQueryScope(Builder $query, Model $record): Builder
    {
        $key = $record->getKey();

        return $query->excludingDescendantsOf(is_scalar($key) ? (string) $key : '');
    }

    /**
     * @param  Builder<Collection>  $query
     * @return array<string, string>
     */
    protected static function changeParentSearchResults(Builder $query): array
    {
        return CollectionDisplayLabel::withDisplayLabel($query)
            ->get()
            ->mapWithKeys(fn (Collection $collection): array => [
                $collection->id => $collection->display_label !== $collection->internal_name
                    ? $collection->display_label.' ['.$collection->internal_name.']'
                    : $collection->internal_name,
            ])->all();
    }

    protected static function changeParentOptionLabel(mixed $value): string
    {
        return CollectionDisplayLabel::resolveLabel($value) ?: (is_scalar($value) ? (string) $value : '');
    }

    protected static ?string $navigationIcon = 'heroicon-o-archive-box';

    protected static ?string $navigationGroup = 'Inventory';

    protected static ?int $navigationSort = 4;

    protected static ?string $recordTitleAttribute = 'internal_name';

    public static function getRecordTitle(?Model $record): string|Htmlable|null
    {
        if ($record === null) {
            return static::getModelLabel();
        }

        if (! $record instanceof Collection) {
            $key = $record->getKey();

            return is_scalar($key) ? (string) $key : '';
        }

        $record->loadMissing(['translations']);

        return CollectionDisplayLabel::resolveForRecord($record);
    }

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'internal_name', 'backward_compatibility', 'translations.title', 'parent.internal_name', 'country.internal_name'];
    }

    public static function canViewAny(): bool
    {
        return auth()->user()?->hasPermissionTo(Permission::VIEW_DATA->value) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canViewAny();
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                FiltersSection::make('Core information')
                    ->schema([
                        Select::make('type')
                            ->options(self::TYPE_OPTIONS)
                            ->required(),
                        Select::make('purpose')
                            ->options(self::PURPOSE_OPTIONS)
                            ->nullable(),
                        Select::make('language_id')
                            ->label('Language')
                            ->relationship('language', 'internal_name')
                            ->searchable(),
                        Select::make('context_id')
                            ->label('Context')
                            ->relationship('context', 'internal_name')
                            ->searchable(),
                        RecordSelect::forCollections(
                            name: 'parent_id',
                            label: 'Parent collection',
                            required: false,
                            scope: fn (Builder $query, ?Model $record): Builder => $record instanceof Collection
                                ? RecordSelect::excludingDescendantsOf($query, $record)
                                : $query,
                        ),
                        Select::make('country_id')
                            ->label('Country')
                            ->relationship('country', 'internal_name')
                            ->searchable(),
                        TextInput::make('latitude')
                            ->numeric(),
                        TextInput::make('longitude')
                            ->numeric(),
                        TextInput::make('map_zoom')
                            ->label('Map zoom')
                            ->numeric()
                            ->integer(),
                    ])
                    ->columns(2),
                FiltersSection::make('Technical identification')
                    ->description('System metadata used for technical identification and legacy imports.')
                    ->schema([
                        TextInput::make('internal_name')
                            ->required()
                            ->maxLength(255)
                            ->unique(ignoreRecord: true),
                        TextInput::make('backward_compatibility')
                            ->label('Legacy code')
                            ->maxLength(255),
                        ExtraJsonField::formComponent(),
                    ])
                    ->columns(2)
                    ->collapsed(fn (?Collection $record): bool => $record !== null),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (Collection $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->modifyQueryUsing(fn (Builder $query): Builder => CollectionDisplayLabel::withDisplayLabel(
                static::withFallbackExists(
                    $query->with([
                        'parent:id,internal_name',
                        'parent.translations',
                        'context:id,internal_name',
                        'language:id,internal_name',
                    ])
                )
            ))
            ->defaultSort('internal_name', 'asc')
            ->columns([
                CollectionDisplayLabel::displayLabelColumn()
                    ->url(fn (Collection $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null),
                static::fallbackTranslationColumn(),
                TextColumn::make('type')
                    ->badge()
                    ->sortable(),
                TextColumn::make('purpose')
                    ->badge()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('parent_display_label')
                    ->label('Parent')
                    ->getStateUsing(function (Collection $record): ?string {
                        if (! $record->parent_id || ! $record->parent) {
                            return null;
                        }

                        return CollectionDisplayLabel::resolveForRecord($record->parent);
                    })
                    ->sortable(false)
                    ->toggleable()
                    ->url(fn (Collection $record): ?string => $record->parent
                        ? (auth()->user()?->can('view', $record->parent) ? static::getUrl('view', ['record' => $record->parent]) : null)
                        : null),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->sortable()
                    ->toggleable()
                    ->url(fn (Collection $record): ?string => $record->context
                        ? (auth()->user()?->can('view', $record->context) ? ContextResource::getUrl('view', ['record' => $record->context]) : null)
                        : null),
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->toggleable()
                    ->url(fn (Collection $record): ?string => $record->language
                        ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                        : null),
                static::backwardCompatibilityColumn(),
                static::uuidColumn(),
                ...static::timestampsColumns(),
                static::internalNameColumn()
                    ->label('Internal name')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                ...static::translationCoverageFilters(),
                SelectFilter::make('type')
                    ->options(self::TYPE_OPTIONS),
                SelectFilter::make('purpose')
                    ->options(self::PURPOSE_OPTIONS),
                SelectFilter::make('parent_id')
                    ->label('Parent')
                    ->relationship('parent', 'internal_name')
                    ->getSearchResultsUsing(fn (string $search): array => CollectionDisplayLabel::withDisplayLabel(
                        Collection::query()
                            ->where('internal_name', 'like', "%{$search}%")
                            ->orWhere('backward_compatibility', 'like', "%{$search}%")
                            ->orWhere('id', 'like', "%{$search}%")
                            ->orderBy('internal_name')
                            ->limit(50)
                    )->get()->mapWithKeys(fn (Collection $c): array => [
                        $c->id => $c->display_label !== $c->internal_name
                            ? $c->display_label.' ['.$c->internal_name.']'
                            : $c->internal_name,
                    ])->all())
                    ->getOptionLabelUsing(fn (mixed $value): string => CollectionDisplayLabel::resolveLabel($value) ?: (is_scalar($value) ? (string) $value : ''))
                    ->searchable(),
                SelectFilter::make('partner')
                    ->label('Partner')
                    ->getSearchResultsUsing(fn (string $search): array => Partner::query()
                        ->where('internal_name', 'like', "%{$search}%")
                        ->orWhere('backward_compatibility', 'like', "%{$search}%")
                        ->orWhere('id', 'like', "%{$search}%")
                        ->orderBy('internal_name')
                        ->limit(50)
                        ->pluck('internal_name', 'id')
                        ->all()
                    )
                    ->getOptionLabelUsing(fn (mixed $value): string => is_string($value) ? (Partner::find($value)->internal_name ?? $value) : '')
                    ->searchable()
                    ->query(fn (Builder $query, array $data): Builder => $data['value']
                        ? $query->whereHas('partners', fn (Builder $q): Builder => $q->where('partners.id', $data['value']))
                        : $query),
                SelectFilter::make('project')
                    ->label('Project')
                    ->getSearchResultsUsing(fn (string $search): array => Project::query()
                        ->where('internal_name', 'like', "%{$search}%")
                        ->orWhere('backward_compatibility', 'like', "%{$search}%")
                        ->orWhere('id', 'like', "%{$search}%")
                        ->orderBy('internal_name')
                        ->limit(50)
                        ->pluck('internal_name', 'id')
                        ->all()
                    )
                    ->getOptionLabelUsing(fn (mixed $value): string => is_string($value) ? (Project::find($value)->internal_name ?? $value) : '')
                    ->searchable()
                    ->query(fn (Builder $query, array $data): Builder => $data['value']
                        ? $query->whereHas('items', fn (Builder $q): Builder => $q->where('project_id', $data['value']))
                        : $query),
                SelectFilter::make('country_id')
                    ->label('Country')
                    ->relationship('country', 'internal_name')
                    ->getSearchResultsUsing(fn (string $search): array => Country::query()
                        ->where('internal_name', 'like', "%{$search}%")
                        ->orWhere('id', 'like', "%{$search}%")
                        ->orderBy('internal_name')
                        ->limit(50)
                        ->pluck('internal_name', 'id')
                        ->all()
                    )
                    ->getOptionLabelUsing(fn (mixed $value): string => is_string($value) ? (Country::find($value)->internal_name ?? $value) : '')
                    ->searchable(),
            ])
            ->filtersFormColumns(2)
            ->filtersLayout(FiltersLayout::AboveContentCollapsible)
            ->filtersFormSchema(function (array $filters): array {
                /** @var array<string, Component> $filters */
                return [
                    FiltersSection::make('Translation Coverage')
                        ->schema([
                            $filters['has_fallback_translation'],
                            $filters['missing_fallback_translation'],
                            $filters['translation_language_has'],
                            $filters['translation_language_missing'],
                            $filters['translation_context_has'],
                            $filters['translation_context_missing'],
                        ])
                        ->columns(2),
                    FiltersSection::make('Collection Filters')
                        ->schema([
                            $filters['type'],
                            $filters['purpose'],
                            $filters['parent_id'],
                            $filters['partner'],
                            $filters['project'],
                            $filters['country_id'],
                        ])
                        ->columns(2),
                ];
            })
            ->actions([
                ViewAction::make(),
                EditAction::make(),
                static::changeParentAction(),
                DeleteAction::make(),
            ])
            ->bulkActions([
                static::moveToParentAction(),
            ]);
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->inlineLabel()
            ->schema([
                InfolistSection::make('Core Information')
                    ->schema([
                        TextEntry::make('type'),
                        TextEntry::make('purpose')
                            ->placeholder('None'),
                        TextEntry::make('parent_display_label')
                            ->label('Parent')
                            ->getStateUsing(fn (Collection $record): ?string => $record->parent_id
                                ? CollectionDisplayLabel::resolveLabel($record->parent_id)
                                : null)
                            ->url(fn (Collection $record): ?string => $record->parent
                                ? (auth()->user()?->can('view', $record->parent) ? static::getUrl('view', ['record' => $record->parent]) : null)
                                : null),
                        TextEntry::make('context.internal_name')
                            ->label('Context')
                            ->url(fn (Collection $record): ?string => $record->context
                                ? (auth()->user()?->can('view', $record->context) ? ContextResource::getUrl('view', ['record' => $record->context]) : null)
                                : null),
                        TextEntry::make('language.internal_name')
                            ->label('Language')
                            ->url(fn (Collection $record): ?string => $record->language
                                ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                                : null),
                        TextEntry::make('country.internal_name')
                            ->label('Country')
                            ->url(fn (Collection $record): ?string => $record->country
                                ? (auth()->user()?->can('view', $record->country) ? CountryResource::getUrl('view', ['record' => $record->country]) : null)
                                : null),
                        TextEntry::make('latitude'),
                        TextEntry::make('longitude'),
                        TextEntry::make('map_zoom')
                            ->label('Map zoom'),
                    ])
                    ->columns(2),
                InfolistSection::make('System Information')
                    ->schema([
                        static::uuidInfolistEntry(),
                        TextEntry::make('internal_name')
                            ->label('Internal name'),
                        TextEntry::make('backward_compatibility')
                            ->label('Legacy code'),
                        ...static::timestampsInfolistEntries(),
                        ExtraJsonField::infolistEntry(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),
                static::legacyLinksSection(),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            ChildCollectionsRelationManager::class,
            TranslationsRelationManager::class,
            ItemsRelationManager::class,
            PartnersRelationManager::class,
            ImagesRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListCollection::route('/'),
            'create' => CreateCollection::route('/create'),
            'edit' => EditCollection::route('/{record}/edit'),
            'view' => ViewCollection::route('/{record}'),
        ];
    }
}
