<?php

namespace App\Filament\Resources;

use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasPlainTextRecordTitle;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\TagResource\Pages\CreateTag;
use App\Filament\Resources\TagResource\Pages\EditTag;
use App\Filament\Resources\TagResource\Pages\ListTag;
use App\Filament\Resources\TagResource\Pages\ViewTag;
use App\Filament\Support\EntityColor;
use App\Filament\Support\MarkdownState;
use App\Models\Language;
use App\Models\Tag;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Auth\Access\Response;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Gate;

class TagResource extends Resource
{
    use HasBackwardCompatibilityColumn;
    use HasPlainTextRecordTitle;
    use HasTimestampsColumns;
    use HasUuidColumn;

    private const CATEGORY_OPTIONS = [
        'keyword' => 'Keyword',
        'material' => 'Material',
        'artist' => 'Artist',
        'dynasty' => 'Dynasty',
        'subject' => 'Subject',
        'theme' => 'Theme',
        'audience' => 'Audience',
        'type' => 'Type',
        'filter' => 'Filter',
        'image-type' => 'Image type',
    ];

    protected static ?string $model = Tag::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-tag';

    protected static string|\UnitEnum|null $navigationGroup = 'Shared Data';

    protected static ?int $navigationSort = 2;

    protected static ?string $recordTitleAttribute = 'description';

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'internal_name', 'backward_compatibility', 'description', 'language.internal_name'];
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
                TextInput::make('description')
                    ->required()
                    ->maxLength(255),
                Select::make('category')
                    ->options(static::categoryOptions())
                    ->searchable()
                    ->preload(),
                Select::make('language_id')
                    ->label('Language')
                    ->relationship('language', 'internal_name')
                    ->searchable(),
                TextInput::make('backward_compatibility')
                    ->label('Legacy code')
                    ->maxLength(255),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (Tag $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->defaultSort('description', 'asc')
            ->columns([
                TextColumn::make('description')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Tag')
                    ->badge()
                    ->color(fn (Tag $record): array => EntityColor::palette($record->category ?? 'tags'))
                    ->searchable(['description', 'internal_name'])
                    ->sortable(),
                TextColumn::make('category')
                    ->badge()
                    ->formatStateUsing(fn (?string $state): string => $state !== null ? (static::categoryOptions()[$state] ?? 'Uncategorised') : 'Uncategorised')
                    ->color(fn (Tag $record): array => EntityColor::palette($record->category ?? 'tags'))
                    ->sortable(),
                TextColumn::make('internal_name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->searchable()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                static::backwardCompatibilityColumn(),
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true)
                    ->url(fn (Tag $record): ?string => $record->language
                        ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                        : null),
                static::uuidColumn(),
                ...static::timestampsColumns(),
            ])
            ->filters([
                SelectFilter::make('category')
                    ->options(static::categoryOptions()),
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
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->inlineLabel()
            ->components([
                Section::make('Core Information')
                    ->schema([
                        TextEntry::make('description')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Tag'),
                        TextEntry::make('category')
                            ->formatStateUsing(fn (?string $state): string => $state !== null ? (static::categoryOptions()[$state] ?? 'Uncategorised') : 'Uncategorised'),
                        TextEntry::make('internal_name')->formatStateUsing(MarkdownState::inline()),
                        TextEntry::make('language.internal_name')
                            ->label('Language')
                            ->url(fn (Tag $record): ?string => $record->language
                                ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                                : null),
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

    /**
     * @return Builder<Tag>
     */
    public static function getEloquentQuery(): Builder
    {
        /** @var Builder<Tag> $query */
        $query = parent::getEloquentQuery();

        return $query->with('language');
    }

    public static function getPages(): array
    {
        return [
            'index' => ListTag::route('/'),
            'create' => CreateTag::route('/create'),
            'edit' => EditTag::route('/{record}/edit'),
            'view' => ViewTag::route('/{record}'),
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function categoryOptions(): array
    {
        return self::CATEGORY_OPTIONS;
    }
}
