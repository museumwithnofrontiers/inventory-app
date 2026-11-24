<?php

namespace App\Filament\Resources;

use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasPlainTextRecordTitle;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\ProjectResource\Pages\CreateProject;
use App\Filament\Resources\ProjectResource\Pages\EditProject;
use App\Filament\Resources\ProjectResource\Pages\ListProject;
use App\Filament\Resources\ProjectResource\Pages\ViewProject;
use App\Filament\Resources\ProjectResource\RelationManagers\CollectionsRelationManager;
use App\Filament\Resources\ProjectResource\RelationManagers\ItemsRelationManager;
use App\Filament\Resources\ProjectResource\RelationManagers\PartnersRelationManager;
use App\Filament\Resources\ProjectResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Support\MarkdownState;
use App\Models\Context;
use App\Models\Language;
use App\Models\Project;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Component;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Enums\FiltersLayout;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Auth\Access\Response;
use Illuminate\Support\Facades\Gate;

class ProjectResource extends Resource
{
    use HasBackwardCompatibilityColumn;
    use HasInternalNameColumn;
    use HasPlainTextRecordTitle;
    use HasTimestampsColumns;
    use HasUuidColumn;

    protected static ?string $model = Project::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-folder';

    protected static string|\UnitEnum|null $navigationGroup = 'Inventory';

    protected static ?int $navigationSort = 6;

    protected static ?string $recordTitleAttribute = 'internal_name';

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'internal_name', 'backward_compatibility'];
    }

    public static function getViewAnyAuthorizationResponse(): Response
    {
        return Gate::inspect('viewAny', static::getModel());
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canViewAny();
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('internal_name')
                    ->required()
                    ->maxLength(255),
                TextInput::make('backward_compatibility')
                    ->label('Legacy code')
                    ->maxLength(255),
                DatePicker::make('launch_date')
                    ->label('Launch date')
                    ->helperText('The date MWNF started the work.'),
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
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->filters([
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
                    Section::make('Project Filters')
                        ->schema([
                            $filters['context_id'],
                            $filters['language_id'],
                        ])
                        ->columns(2),
                ];
            });
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->inlineLabel()
            ->components([
                Section::make('Core Information')
                    ->schema([
                        TextEntry::make('internal_name')->formatStateUsing(MarkdownState::inline()),
                        TextEntry::make('launch_date')
                            ->label('Launch date')
                            ->date(),
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
                Section::make('Links')
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
                Section::make('System Information')
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
            TranslationsRelationManager::class,
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
