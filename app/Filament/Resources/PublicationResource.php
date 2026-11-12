<?php

namespace App\Filament\Resources;

use App\Enums\Permission;
use App\Enums\PublicationCategory;
use App\Enums\PublicationImageKind;
use App\Enums\PublicationStatus;
use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\PublicationResource\Pages\CreatePublication;
use App\Filament\Resources\PublicationResource\Pages\EditPublication;
use App\Filament\Resources\PublicationResource\Pages\ListPublication;
use App\Filament\Resources\PublicationResource\Pages\ViewPublication;
use App\Filament\Resources\PublicationResource\RelationManagers\CollectionsRelationManager;
use App\Filament\Resources\PublicationResource\RelationManagers\EditionsRelationManager;
use App\Filament\Resources\PublicationResource\RelationManagers\ImagesRelationManager;
use App\Filament\Resources\PublicationResource\RelationManagers\ItemsRelationManager;
use App\Filament\Resources\PublicationResource\RelationManagers\TagsRelationManager;
use App\Filament\Resources\PublicationResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Support\ExtraJsonField;
use App\Models\Country;
use App\Models\Project;
use App\Models\Publication;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Infolists\Components\Section as InfolistSection;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\RelationManagers\RelationGroup;
use Filament\Resources\Resource;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class PublicationResource extends Resource
{
    use HasBackwardCompatibilityColumn;
    use HasInternalNameColumn;
    use HasTimestampsColumns;
    use HasUuidColumn;

    protected static ?string $model = Publication::class;

    protected static ?string $navigationIcon = 'heroicon-o-book-open';

    protected static ?string $navigationGroup = 'Inventory';

    protected static ?int $navigationSort = 4;

    protected static ?string $recordTitleAttribute = 'internal_name';

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'internal_name', 'backward_compatibility', 'translations.title'];
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
                Section::make('Core information')
                    ->schema([
                        Select::make('category')
                            ->options(PublicationCategory::options())
                            ->required(),
                        Select::make('status')
                            ->options(PublicationStatus::options())
                            ->default(PublicationStatus::PUBLISHED->value)
                            ->required(),
                        Select::make('language_id')
                            ->label('Main language')
                            ->relationship('language', 'internal_name')
                            ->searchable()
                            ->required(),
                        Select::make('project_id')
                            ->label('Project')
                            ->relationship('project', 'internal_name')
                            ->searchable()
                            ->nullable(),
                        Select::make('country_id')
                            ->label('Country')
                            ->relationship('country', 'internal_name')
                            ->searchable()
                            ->nullable(),
                        TextInput::make('display_order')
                            ->label('Display order')
                            ->numeric()
                            ->integer()
                            ->nullable(),
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
                            ->unique(ignoreRecord: true)
                            ->nullable(),
                        ExtraJsonField::formComponent(),
                    ])
                    ->columns(2)
                    ->collapsed(fn (?Publication $record): bool => $record !== null),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (Publication $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with([
                'project:id,internal_name',
                'country:id,internal_name',
                'translations:id,publication_id,language_id',
            ]))
            ->defaultSort('internal_name', 'asc')
            ->columns([
                static::internalNameColumn(),
                TextColumn::make('category')
                    ->badge()
                    ->formatStateUsing(fn (?PublicationCategory $state): ?string => $state?->label())
                    ->sortable(),
                TextColumn::make('project.internal_name')
                    ->label('Project')
                    ->sortable()
                    ->toggleable()
                    ->url(fn (Publication $record): ?string => $record->project
                        ? (auth()->user()?->can('view', $record->project) ? ProjectResource::getUrl('view', ['record' => $record->project]) : null)
                        : null),
                TextColumn::make('country.internal_name')
                    ->label('Country')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('status')
                    ->badge()
                    ->formatStateUsing(fn (?PublicationStatus $state): ?string => $state?->label())
                    ->color(fn (?PublicationStatus $state): string => $state === PublicationStatus::IN_PREPARATION ? 'warning' : 'success')
                    ->sortable(),
                TextColumn::make('languages')
                    ->label('Languages')
                    ->getStateUsing(fn (Publication $record): string => $record->translations
                        ->pluck('language_id')
                        ->unique()
                        ->sort()
                        ->implode(', '))
                    ->toggleable(),
                static::backwardCompatibilityColumn(),
                static::uuidColumn(),
                ...static::timestampsColumns(),
            ])
            ->filters([
                SelectFilter::make('category')
                    ->options(PublicationCategory::options()),
                SelectFilter::make('status')
                    ->options(PublicationStatus::options()),
                SelectFilter::make('project_id')
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
                    ->getOptionLabelUsing(function (mixed $value): string {
                        $project = Project::query()->whereKey($value)->first();

                        return $project !== null ? $project->internal_name : (is_scalar($value) ? (string) $value : '');
                    })
                    ->searchable(),
                SelectFilter::make('country_id')
                    ->label('Country')
                    ->getSearchResultsUsing(fn (string $search): array => Country::query()
                        ->where('internal_name', 'like', "%{$search}%")
                        ->orWhere('id', 'like', "%{$search}%")
                        ->orderBy('internal_name')
                        ->limit(50)
                        ->pluck('internal_name', 'id')
                        ->all()
                    )
                    ->getOptionLabelUsing(function (mixed $value): string {
                        $country = Country::query()->whereKey($value)->first();

                        return $country !== null ? $country->internal_name : (is_scalar($value) ? (string) $value : '');
                    })
                    ->searchable(),
            ])
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
                        TextEntry::make('category')
                            ->badge()
                            ->formatStateUsing(fn (?PublicationCategory $state): ?string => $state?->label()),
                        TextEntry::make('status')
                            ->badge()
                            ->formatStateUsing(fn (?PublicationStatus $state): ?string => $state?->label()),
                        TextEntry::make('language.internal_name')
                            ->label('Main language')
                            ->url(fn (Publication $record): ?string => $record->language
                                ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                                : null),
                        TextEntry::make('project.internal_name')
                            ->label('Project')
                            ->placeholder('None')
                            ->url(fn (Publication $record): ?string => $record->project
                                ? (auth()->user()?->can('view', $record->project) ? ProjectResource::getUrl('view', ['record' => $record->project]) : null)
                                : null),
                        TextEntry::make('country.internal_name')
                            ->label('Country')
                            ->placeholder('None')
                            ->url(fn (Publication $record): ?string => $record->country
                                ? (auth()->user()?->can('view', $record->country) ? CountryResource::getUrl('view', ['record' => $record->country]) : null)
                                : null),
                        TextEntry::make('display_order')
                            ->label('Display order')
                            ->placeholder('None'),
                        TextEntry::make('translations_count')
                            ->label('Translations')
                            ->state(fn (Publication $record): int => $record->translations()->count()),
                        TextEntry::make('editions_count')
                            ->label('Editions')
                            ->state(fn (Publication $record): int => $record->editions()->count()),
                        TextEntry::make('covers_count')
                            ->label('Covers')
                            ->state(fn (Publication $record): int => $record->publicationImages()->where('kind', PublicationImageKind::COVER->value)->count()),
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
            ]);
    }

    public static function getRelations(): array
    {
        return [
            RelationGroup::make('Content', [
                TranslationsRelationManager::class,
                EditionsRelationManager::class,
                ImagesRelationManager::class,
            ]),
            RelationGroup::make('Links', [
                CollectionsRelationManager::class,
                ItemsRelationManager::class,
                TagsRelationManager::class,
            ]),
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListPublication::route('/'),
            'create' => CreatePublication::route('/create'),
            'edit' => EditPublication::route('/{record}/edit'),
            'view' => ViewPublication::route('/{record}'),
        ];
    }
}
