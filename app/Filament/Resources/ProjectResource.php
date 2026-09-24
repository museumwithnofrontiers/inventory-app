<?php

namespace App\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\ProjectResource\Pages\CreateProject;
use App\Filament\Resources\ProjectResource\Pages\EditProject;
use App\Filament\Resources\ProjectResource\Pages\ListProject;
use App\Filament\Resources\ProjectResource\Pages\ViewProject;
use App\Filament\Resources\ProjectResource\RelationManagers\CollectionsRelationManager;
use App\Filament\Resources\ProjectResource\RelationManagers\ItemsRelationManager;
use App\Filament\Resources\ProjectResource\RelationManagers\PartnersRelationManager;
use App\Models\Context;
use App\Models\Language;
use App\Models\Project;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\DatePicker;
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

class ProjectResource extends Resource
{
    use HasBackwardCompatibilityColumn;
    use HasInternalNameColumn;
    use HasTimestampsColumns;
    use HasUuidColumn;

    protected static ?string $model = Project::class;

    protected static ?string $navigationIcon = 'heroicon-o-folder';

    protected static ?string $navigationGroup = 'Inventory';

    protected static ?int $navigationSort = 6;

    protected static ?string $recordTitleAttribute = 'internal_name';

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'internal_name', 'backward_compatibility'];
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
                TextInput::make('internal_name')
                    ->required()
                    ->maxLength(255),
                TextInput::make('backward_compatibility')
                    ->label('Legacy code')
                    ->maxLength(255),
                DatePicker::make('launch_date')
                    ->label('Launch date'),
                Toggle::make('is_launched')
                    ->label('Launched'),
                Toggle::make('is_enabled')
                    ->label('Enabled')
                    ->default(true),
                TextInput::make('site_url')
                    ->label('Public site URL')
                    ->url()
                    ->maxLength(255),
                TextInput::make('related_database_url')
                    ->label('Related database URL')
                    ->url()
                    ->maxLength(255),
                TextInput::make('artistic_introduction_url')
                    ->label('Artistic introduction URL')
                    ->url()
                    ->maxLength(255),
                TextInput::make('copyright')
                    ->label('Copyright')
                    ->helperText('Default copyright for this project\'s images that don\'t set their own. Leave blank to use the site-wide default.')
                    ->maxLength(500)
                    ->nullable()
                    ->dehydrateStateUsing(fn (?string $state): ?string => filled($state) ? $state : null),
                Select::make('context_id')
                    ->label('Context')
                    ->relationship('context', 'internal_name')
                    ->searchable(),
                Select::make('language_id')
                    ->label('Language')
                    ->relationship('language', 'internal_name')
                    ->searchable(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (Project $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->defaultSort('internal_name', 'asc')
            ->columns([
                static::internalNameColumn(),
                static::backwardCompatibilityColumn(),
                IconColumn::make('is_enabled')
                    ->label('Enabled')
                    ->boolean()
                    ->sortable(),
                IconColumn::make('is_launched')
                    ->label('Launched')
                    ->boolean()
                    ->sortable(),
                TextColumn::make('launch_date')
                    ->label('Launch date')
                    ->date()
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('site_url')
                    ->label('Public site URL')
                    ->url(fn (Project $record): ?string => $record->site_url, shouldOpenInNewTab: true)
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('related_database_url')
                    ->label('Related database URL')
                    ->url(fn (Project $record): ?string => $record->related_database_url, shouldOpenInNewTab: true)
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('artistic_introduction_url')
                    ->label('Artistic introduction URL')
                    ->url(fn (Project $record): ?string => $record->artistic_introduction_url, shouldOpenInNewTab: true)
                    ->toggleable(isToggledHiddenByDefault: true),
                static::uuidColumn(),
                ...static::timestampsColumns(),
            ])
            ->actions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->filters([
                TernaryFilter::make('is_enabled')
                    ->label('Enabled')
                    ->trueLabel('Enabled only')
                    ->falseLabel('Disabled only'),
                TernaryFilter::make('is_launched')
                    ->label('Launched')
                    ->trueLabel('Launched only')
                    ->falseLabel('Not launched only'),
                SelectFilter::make('context_id')
                    ->label('Context')
                    ->getSearchResultsUsing(fn (string $search): array => Context::query()
                        ->where('internal_name', 'like', "%{$search}%")
                        ->orWhere('backward_compatibility', 'like', "%{$search}%")
                        ->orWhere('id', 'like', "%{$search}%")
                        ->orderBy('internal_name')
                        ->limit(50)
                        ->pluck('internal_name', 'id')
                        ->all()
                    )
                    ->getOptionLabelUsing(fn (mixed $value): string => is_string($value) ? (Context::find($value)->internal_name ?? $value) : '')
                    ->searchable(),
                SelectFilter::make('language_id')
                    ->label('Language')
                    ->getSearchResultsUsing(fn (string $search): array => Language::query()
                        ->where('internal_name', 'like', "%{$search}%")
                        ->orWhere('id', 'like', "%{$search}%")
                        ->orderBy('internal_name')
                        ->limit(50)
                        ->pluck('internal_name', 'id')
                        ->all()
                    )
                    ->getOptionLabelUsing(fn (mixed $value): string => is_string($value) ? (Language::find($value)->internal_name ?? $value) : '')
                    ->searchable(),
            ])
            ->filtersFormColumns(2)
            ->filtersLayout(FiltersLayout::AboveContentCollapsible)
            ->filtersFormSchema(function (array $filters): array {
                /** @var array<string, Component> $filters */
                return [
                    FiltersSection::make('Project Filters')
                        ->schema([
                            $filters['is_enabled'],
                            $filters['is_launched'],
                            $filters['context_id'],
                            $filters['language_id'],
                        ])
                        ->columns(2),
                ];
            });
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->inlineLabel()
            ->schema([
                InfolistSection::make('Core Information')
                    ->schema([
                        TextEntry::make('internal_name'),
                        TextEntry::make('launch_date')
                            ->label('Launch date')
                            ->date(),
                        IconEntry::make('is_launched')
                            ->label('Launched')
                            ->boolean(),
                        IconEntry::make('is_enabled')
                            ->label('Enabled')
                            ->boolean(),
                        TextEntry::make('context.internal_name')
                            ->label('Context')
                            ->url(fn (Project $record): ?string => $record->context
                                ? (auth()->user()?->can('view', $record->context) ? ContextResource::getUrl('view', ['record' => $record->context]) : null)
                                : null),
                        TextEntry::make('language.internal_name')
                            ->label('Language')
                            ->url(fn (Project $record): ?string => $record->language
                                ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                                : null),
                    ])
                    ->columns(2),
                InfolistSection::make('Links')
                    ->schema([
                        TextEntry::make('site_url')
                            ->label('Public site URL')
                            ->url(fn (Project $record): ?string => $record->site_url)
                            ->openUrlInNewTab()
                            ->placeholder('—'),
                        TextEntry::make('related_database_url')
                            ->label('Related database URL')
                            ->url(fn (Project $record): ?string => $record->related_database_url)
                            ->openUrlInNewTab()
                            ->placeholder('—'),
                        TextEntry::make('artistic_introduction_url')
                            ->label('Artistic introduction URL')
                            ->url(fn (Project $record): ?string => $record->artistic_introduction_url)
                            ->openUrlInNewTab()
                            ->placeholder('—'),
                    ])
                    ->columns(2),
                InfolistSection::make('System Information')
                    ->schema([
                        static::uuidInfolistEntry(),
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
            ItemsRelationManager::class,
            CollectionsRelationManager::class,
            PartnersRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListProject::route('/'),
            'create' => CreateProject::route('/create'),
            'edit' => EditProject::route('/{record}/edit'),
            'view' => ViewProject::route('/{record}'),
        ];
    }
}
