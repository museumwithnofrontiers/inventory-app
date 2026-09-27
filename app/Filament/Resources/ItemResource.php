<?php

namespace App\Filament\Resources;

use App\Enums\ItemType;
use App\Enums\Permission;
use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasChangeParentAction;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasLegacyLinksInfolistSection;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasTranslationCoverageFilters;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\ItemResource\Pages\CreateItem;
use App\Filament\Resources\ItemResource\Pages\EditItem;
use App\Filament\Resources\ItemResource\Pages\ListItem;
use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\ArtistsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\ChildItemsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\CollectionAppearancesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\DocumentsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\DynastiesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\ImagesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\IncomingLinksRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\MediaRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\OutgoingLinksRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\PictureItemsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TagsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TimelineEventsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\WorkshopsRelationManager;
use App\Filament\Support\CollectionDisplayLabel;
use App\Filament\Support\ItemDisplayLabel;
use App\Filament\Support\RecordSelect;
use App\Models\Collection;
use App\Models\Country;
use App\Models\Item;
use App\Models\Partner;
use App\Models\Project;
use App\Models\Tag;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\Section as FiltersSection;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Infolists\Components\Section as InfolistSection;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Infolist;
use Filament\Notifications\Notification;
use Filament\Resources\RelationManagers\RelationGroup;
use Filament\Resources\Resource;
use Filament\Tables\Actions\BulkAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Enums\FiltersLayout;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Model;

class ItemResource extends Resource
{
    use HasBackwardCompatibilityColumn;

    /** @use HasChangeParentAction<Item> */
    use HasChangeParentAction;

    use HasInternalNameColumn;
    use HasLegacyLinksInfolistSection;
    use HasTimestampsColumns;
    use HasTranslationCoverageFilters;
    use HasUuidColumn;

    protected static ?string $model = Item::class;

    protected static function changeParentModelClass(): string
    {
        return Item::class;
    }

    protected static function changeParentSelectLabel(): string
    {
        return 'New parent item';
    }

    protected static function changeParentPluralLabel(): string
    {
        return 'Items';
    }

    /**
     * @param  Builder<Item>  $query
     * @return Builder<Item>
     */
    protected static function changeParentRowQueryScope(Builder $query, Model $record): Builder
    {
        $key = $record->getKey();

        return $query->excludingDescendantsOf(is_scalar($key) ? (string) $key : '');
    }

    /**
     * @param  Builder<Item>  $query
     * @return array<string, string>
     */
    protected static function changeParentSearchResults(Builder $query): array
    {
        return ItemDisplayLabel::withDisplayLabel($query)
            ->get()
            ->mapWithKeys(fn (Item $item): array => [
                $item->id => $item->display_label !== $item->internal_name
                    ? $item->display_label.' ['.$item->internal_name.']'
                    : $item->internal_name,
            ])->all();
    }

    protected static function changeParentOptionLabel(mixed $value): string
    {
        return ItemDisplayLabel::resolveLabel($value) ?: (is_scalar($value) ? (string) $value : '');
    }

    protected static ?string $navigationIcon = 'heroicon-o-cube';

    protected static ?string $navigationGroup = 'Inventory';

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'internal_name';

    public static function getRecordTitle(?Model $record): string|Htmlable|null
    {
        if ($record === null) {
            return static::getModelLabel();
        }

        if (! $record instanceof Item) {
            $key = $record->getKey();

            return is_scalar($key) ? (string) $key : '';
        }

        $record->loadMissing(['translations', 'collection:id,context_id', 'project:id,context_id']);

        return ItemDisplayLabel::resolveForRecord($record);
    }

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'internal_name', 'backward_compatibility', 'translations.name', 'translations.alternate_name', 'partner.internal_name', 'country.internal_name', 'project.internal_name'];
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
                            ->options(
                                collect(ItemType::cases())
                                    ->mapWithKeys(fn (ItemType $type) => [$type->value => $type->label()])
                                    ->all()
                            )
                            ->required(),
                        RecordSelect::forItems(
                            name: 'parent_id',
                            label: 'Parent item',
                            required: false,
                            scope: fn (Builder $query, ?Model $record): Builder => $record instanceof Item
                                ? RecordSelect::excludingDescendantsOf($query, $record)
                                : $query,
                        ),
                        RecordSelect::forPartners(
                            name: 'partner_id',
                            label: 'Partner',
                            required: false,
                        ),
                        Select::make('country_id')
                            ->label('Country')
                            ->relationship('country', 'internal_name')
                            ->searchable()
                            ->nullable(),
                        Select::make('project_id')
                            ->label('Project')
                            ->relationship('project', 'internal_name')
                            ->searchable()
                            ->nullable(),
                        TextInput::make('display_order')
                            ->label('Display order')
                            ->numeric()
                            ->integer()
                            ->nullable(),
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
                    ])
                    ->columns(2)
                    ->collapsed(fn (?Item $record): bool => $record !== null),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (Item $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->modifyQueryUsing(fn (Builder $query): Builder => ItemDisplayLabel::withDisplayLabel(
                static::withFallbackExists(
                    $query->with([
                        'parent:id,internal_name,collection_id,project_id',
                        'parent.translations',
                        'parent.collection:id,context_id',
                        'parent.project:id,context_id',
                        'partner:id,internal_name',
                        'country:id,internal_name',
                        'project:id,internal_name',
                    ])
                )
            ))
            ->defaultSort('internal_name', 'asc')
            ->columns([
                ItemDisplayLabel::displayLabelColumn()
                    ->url(fn (Item $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null),
                static::fallbackTranslationColumn(),
                TextColumn::make('type')
                    ->badge()
                    ->formatStateUsing(fn (?ItemType $state): ?string => $state?->label())
                    ->sortable(),
                TextColumn::make('parent_display_label')
                    ->label('Parent')
                    ->getStateUsing(function (Item $record): ?string {
                        if (! $record->parent_id || ! $record->parent) {
                            return null;
                        }

                        return ItemDisplayLabel::resolveForRecord($record->parent);
                    })
                    ->sortable(false)
                    ->toggleable()
                    ->url(fn (Item $record): ?string => $record->parent
                        ? (auth()->user()?->can('view', $record->parent) ? static::getUrl('view', ['record' => $record->parent]) : null)
                        : null),
                TextColumn::make('partner.internal_name')
                    ->label('Partner')
                    ->sortable()
                    ->toggleable()
                    ->url(fn (Item $record): ?string => $record->partner
                        ? (auth()->user()?->can('view', $record->partner) ? PartnerResource::getUrl('view', ['record' => $record->partner]) : null)
                        : null),
                TextColumn::make('country.internal_name')
                    ->label('Country')
                    ->sortable()
                    ->toggleable()
                    ->url(fn (Item $record): ?string => $record->country
                        ? (auth()->user()?->can('view', $record->country) ? CountryResource::getUrl('view', ['record' => $record->country]) : null)
                        : null),
                TextColumn::make('project.internal_name')
                    ->label('Project')
                    ->sortable()
                    ->toggleable()
                    ->url(fn (Item $record): ?string => $record->project
                        ? (auth()->user()?->can('view', $record->project) ? ProjectResource::getUrl('view', ['record' => $record->project]) : null)
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
                    ->options(
                        collect(ItemType::cases())
                            ->mapWithKeys(fn (ItemType $type) => [$type->value => $type->label()])
                            ->all()
                    ),
                SelectFilter::make('partner_id')
                    ->label('Partner')
                    ->relationship('partner', 'internal_name')
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
                    ->searchable(),
                SelectFilter::make('collection')
                    ->label('Collection')
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
                    ->searchable()
                    ->query(fn (Builder $query, array $data): Builder => $data['value']
                        ? $query->whereHas('attachedToCollections', fn (Builder $q): Builder => $q->where('collections.id', $data['value']))
                        : $query),
                SelectFilter::make('project_id')
                    ->label('Project')
                    ->relationship('project', 'internal_name')
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
                    ->searchable(),
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
                SelectFilter::make('tags')
                    ->label('Tag')
                    ->multiple()
                    ->getSearchResultsUsing(fn (string $search): array => Tag::query()
                        ->where('internal_name', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('backward_compatibility', 'like', "%{$search}%")
                        ->orWhere('id', 'like', "%{$search}%")
                        ->orderBy('description')
                        ->limit(50)
                        ->get()
                        ->mapWithKeys(fn (Tag $tag): array => [$tag->id => "{$tag->description} [{$tag->internal_name}]"])
                        ->all()
                    )
                    ->getOptionLabelUsing(fn ($value): string => ($tag = Tag::find(is_scalar($value) ? (string) $value : '')) instanceof Tag ? "{$tag->description} [{$tag->internal_name}]" : (is_scalar($value) ? (string) $value : ''))
                    ->query(function (Builder $query, array $data): Builder {
                        /** @var Builder<Item> $q */
                        $q = $query;

                        /** @var array<int, mixed> $tagValues */
                        $tagValues = is_array($data['values'] ?? null) ? $data['values'] : [];

                        return ! empty($tagValues)
                                ? $q->withAnyTags($tagValues)
                                : $q;
                    }),
                TernaryFilter::make('top_level_only')
                    ->label('Hierarchy')
                    ->trueLabel('Top-level only')
                    ->falseLabel('All items')
                    ->queries(
                        true: fn (Builder $query): Builder => $query->whereNull('parent_id'),
                        false: fn (Builder $query): Builder => $query,
                        blank: fn (Builder $query): Builder => $query,
                    ),
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
                    FiltersSection::make('Item Filters')
                        ->schema([
                            $filters['type'],
                            $filters['partner_id'],
                            $filters['collection'],
                            $filters['project_id'],
                            $filters['country_id'],
                            $filters['tags'],
                            $filters['top_level_only'],
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
                BulkAction::make('attachToCollection')
                    ->label('Attach to collection')
                    ->icon('heroicon-o-archive-box')
                    ->form([
                        Select::make('collection_id')
                            ->label('Collection')
                            ->required()
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
                            ->getOptionLabelUsing(fn ($value): string => CollectionDisplayLabel::resolveLabel($value) ?: (is_scalar($value) ? (string) $value : ''))
                            ->searchable(),
                    ])
                    ->action(function (EloquentCollection $records, array $data): void {
                        $collectionId = $data['collection_id'];
                        foreach ($records as $record) {
                            /** @var Item $record */
                            $record->attachedToCollections()->syncWithoutDetaching([$collectionId]);
                        }

                        Notification::make()
                            ->success()
                            ->title('Items attached to collection')
                            ->send();
                    })
                    ->deselectRecordsAfterCompletion(),
                BulkAction::make('attachTag')
                    ->label('Attach tag')
                    ->icon('heroicon-o-tag')
                    ->form([
                        Select::make('tag_id')
                            ->label('Tag')
                            ->required()
                            ->getSearchResultsUsing(fn (string $search): array => Tag::query()
                                ->where('internal_name', 'like', "%{$search}%")
                                ->orWhere('description', 'like', "%{$search}%")
                                ->orWhere('backward_compatibility', 'like', "%{$search}%")
                                ->orderBy('description')
                                ->limit(50)
                                ->get()
                                ->mapWithKeys(fn (Tag $tag): array => [$tag->id => "{$tag->description} [{$tag->internal_name}]"])
                                ->all()
                            )
                            ->getOptionLabelUsing(fn ($value): string => ($tag = Tag::find(is_scalar($value) ? (string) $value : '')) instanceof Tag ? "{$tag->description} [{$tag->internal_name}]" : (is_scalar($value) ? (string) $value : ''))
                            ->searchable(),
                    ])
                    ->action(function (EloquentCollection $records, array $data): void {
                        $tagId = $data['tag_id'];
                        foreach ($records as $record) {
                            /** @var Item $record */
                            $record->tags()->syncWithoutDetaching([$tagId]);
                        }

                        Notification::make()
                            ->success()
                            ->title('Tag attached to items')
                            ->send();
                    })
                    ->deselectRecordsAfterCompletion(),
            ]);
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->inlineLabel()
            ->schema([
                InfolistSection::make('Core Information')
                    ->schema([
                        TextEntry::make('type')
                            ->formatStateUsing(fn (?ItemType $state): ?string => $state?->label()),
                        TextEntry::make('parent_display_label')
                            ->label('Parent')
                            ->getStateUsing(fn (Item $record): ?string => $record->parent_id
                                ? ItemDisplayLabel::resolveLabel($record->parent_id)
                                : null)
                            ->url(fn (Item $record): ?string => $record->parent
                                ? (auth()->user()?->can('view', $record->parent) ? static::getUrl('view', ['record' => $record->parent]) : null)
                                : null),
                        TextEntry::make('partner.internal_name')
                            ->label('Partner')
                            ->url(fn (Item $record): ?string => $record->partner
                                ? (auth()->user()?->can('view', $record->partner) ? PartnerResource::getUrl('view', ['record' => $record->partner]) : null)
                                : null),
                        TextEntry::make('country.internal_name')
                            ->label('Country')
                            ->url(fn (Item $record): ?string => $record->country
                                ? (auth()->user()?->can('view', $record->country) ? CountryResource::getUrl('view', ['record' => $record->country]) : null)
                                : null),
                        TextEntry::make('project.internal_name')
                            ->label('Project')
                            ->url(fn (Item $record): ?string => $record->project
                                ? (auth()->user()?->can('view', $record->project) ? ProjectResource::getUrl('view', ['record' => $record->project]) : null)
                                : null),
                        TextEntry::make('display_order')
                            ->label('Display order'),
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
            RelationGroup::make('Content', [
                ChildItemsRelationManager::class,
                TranslationsRelationManager::class,
                PictureItemsRelationManager::class,
                CollectionAppearancesRelationManager::class,
                TagsRelationManager::class,
            ]),
            RelationGroup::make('Media', [
                ImagesRelationManager::class,
                MediaRelationManager::class,
                DocumentsRelationManager::class,
            ]),
            RelationGroup::make('Origin', [
                ArtistsRelationManager::class,
                WorkshopsRelationManager::class,
                DynastiesRelationManager::class,
            ]),
            RelationGroup::make('Links', [
                OutgoingLinksRelationManager::class,
                IncomingLinksRelationManager::class,
            ]),
            RelationGroup::make('Timeline', [
                TimelineEventsRelationManager::class,
            ]),
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListItem::route('/'),
            'create' => CreateItem::route('/create'),
            'edit' => EditItem::route('/{record}/edit'),
            'view' => ViewItem::route('/{record}'),
        ];
    }
}
