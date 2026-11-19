<?php

namespace App\Filament\Resources;

use App\Enums\ItemType;
use App\Enums\PartnerCategory;
use App\Enums\Permission;
use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasLegacyLinksInfolistSection;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasTranslationCoverageFilters;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\PartnerResource\Pages\CreatePartner;
use App\Filament\Resources\PartnerResource\Pages\EditPartner;
use App\Filament\Resources\PartnerResource\Pages\ListPartner;
use App\Filament\Resources\PartnerResource\Pages\ViewPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\CollectionParticipationsRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\ContactsRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\ImagesRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\LogosRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\OwnedItemsRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\VisitInformationRelationManager;
use App\Filament\Resources\RelationManagers\LinksRelationManager;
use App\Filament\Support\PartnerDisplayLabel;
use App\Models\Country;
use App\Models\Partner;
use App\Models\Project;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\Section as FiltersSection;
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
use Filament\Tables\Enums\FiltersLayout;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class PartnerResource extends Resource
{
    use HasBackwardCompatibilityColumn;
    use HasInternalNameColumn;
    use HasLegacyLinksInfolistSection;
    use HasTimestampsColumns;
    use HasTranslationCoverageFilters;
    use HasUuidColumn;

    protected static ?string $model = Partner::class;

    protected static ?string $navigationIcon = 'heroicon-o-building-library';

    protected static ?string $navigationGroup = 'Inventory';

    protected static ?int $navigationSort = 5;

    protected static ?string $recordTitleAttribute = 'internal_name';

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'internal_name', 'backward_compatibility', 'translations.name', 'country.internal_name', 'project.internal_name'];
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
                            ->options([
                                'museum' => 'Museum',
                                'institution' => 'Institution',
                                'individual' => 'Individual',
                                'school' => 'School',
                            ])
                            ->required(),
                        Select::make('country_id')
                            ->label('Country')
                            ->relationship('country', 'internal_name')
                            ->searchable(),
                        TextInput::make('latitude')
                            ->numeric(),
                        TextInput::make('longitude')
                            ->numeric(),
                        TextInput::make('map_zoom')
                            ->numeric()
                            ->integer(),
                        Select::make('project_id')
                            ->label('Project')
                            ->relationship('project', 'internal_name')
                            ->searchable(),
                        Select::make('monument_item_id')
                            ->label('Monument item')
                            ->relationship(
                                name: 'monumentItem',
                                titleAttribute: 'internal_name',
                                modifyQueryUsing: fn (Builder $query): Builder => $query->where('type', ItemType::MONUMENT->value),
                            )
                            ->searchable(),
                        Toggle::make('visible')
                            ->default(true),
                        Select::make('category')
                            ->options(PartnerCategory::options())
                            ->placeholder('None')
                            ->helperText('Legacy\'s partner category (Sharing History).'),
                        Toggle::make('featured')
                            ->helperText('The Portal\'s own selection: shown in the featured strip, whether visible or not.')
                            ->default(false),
                        TextInput::make('city')
                            ->helperText('As the Sharing History partner list prints it, for every language.')
                            ->maxLength(255),
                    ])
                    ->columns(2),
                FiltersSection::make('Technical identification')
                    ->description('System metadata used for technical identification and legacy imports.')
                    ->schema([
                        TextInput::make('internal_name')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('backward_compatibility')
                            ->label('Legacy code')
                            ->maxLength(255),
                    ])
                    ->columns(2)
                    ->collapsed(fn (?Partner $record): bool => $record !== null),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (Partner $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->modifyQueryUsing(fn (Builder $query): Builder => PartnerDisplayLabel::withDisplayLabel(
                static::withFallbackExists($query->with([
                    'country:id,internal_name',
                    'project:id,internal_name',
                ]))
            ))
            ->defaultSort('internal_name', 'asc')
            ->columns([
                PartnerDisplayLabel::displayLabelColumn()
                    ->url(fn (Partner $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null),
                static::fallbackTranslationColumn(),
                TextColumn::make('type')
                    ->badge()
                    ->sortable(),
                TextColumn::make('country.internal_name')
                    ->label('Country')
                    ->sortable()
                    ->url(fn (Partner $record): ?string => $record->country
                        ? (auth()->user()?->can('view', $record->country) ? CountryResource::getUrl('view', ['record' => $record->country]) : null)
                        : null),
                TextColumn::make('project.internal_name')
                    ->label('Project')
                    ->sortable()
                    ->url(fn (Partner $record): ?string => $record->project
                        ? (auth()->user()?->can('view', $record->project) ? ProjectResource::getUrl('view', ['record' => $record->project]) : null)
                        : null),
                IconColumn::make('visible')
                    ->boolean()
                    ->sortable(),
                static::backwardCompatibilityColumn(),
                static::uuidColumn(),
                ...static::timestampsColumns(),
                static::internalNameColumn()
                    ->label('Internal name')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                ...static::translationCoverageFilters(),
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
                TernaryFilter::make('visible')
                    ->label('Visibility')
                    ->trueLabel('Visible only')
                    ->falseLabel('Hidden only'),
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
                    FiltersSection::make('Partner Filters')
                        ->schema([
                            $filters['country_id'],
                            $filters['project_id'],
                            $filters['visible'],
                        ])
                        ->columns(2),
                ];
            })
            ->actions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make(),
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
                        TextEntry::make('country.internal_name')
                            ->label('Country')
                            ->url(fn (Partner $record): ?string => $record->country
                                ? (auth()->user()?->can('view', $record->country) ? CountryResource::getUrl('view', ['record' => $record->country]) : null)
                                : null),
                        TextEntry::make('project.internal_name')
                            ->label('Project')
                            ->url(fn (Partner $record): ?string => $record->project
                                ? (auth()->user()?->can('view', $record->project) ? ProjectResource::getUrl('view', ['record' => $record->project]) : null)
                                : null),
                        TextEntry::make('monumentItem.internal_name')
                            ->label('Monument item')
                            ->url(fn (Partner $record): ?string => $record->monumentItem
                                ? (auth()->user()?->can('view', $record->monumentItem) ? ItemResource::getUrl('view', ['record' => $record->monumentItem]) : null)
                                : null),
                        IconEntry::make('visible')
                            ->boolean(),
                        TextEntry::make('category')
                            ->formatStateUsing(fn (?PartnerCategory $state): ?string => $state?->label())
                            ->placeholder('—'),
                        IconEntry::make('featured')
                            ->boolean(),
                        TextEntry::make('city')
                            ->placeholder('—'),
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
            OwnedItemsRelationManager::class,
            TranslationsRelationManager::class,
            CollectionParticipationsRelationManager::class,
            ImagesRelationManager::class,
            LogosRelationManager::class,
            LinksRelationManager::class,
            VisitInformationRelationManager::class,
            ContactsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListPartner::route('/'),
            'create' => CreatePartner::route('/create'),
            'edit' => EditPartner::route('/{record}/edit'),
            'view' => ViewPartner::route('/{record}'),
        ];
    }
}
