<?php

namespace App\Filament\Resources;

use Filament\Schemas\Schema;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Components\Section;
use Filament\Actions\ViewAction;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Actions\DeleteAction;
use App\Filament\Concerns\HasPlainTextRecordTitle;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Resources\CollectionTranslationResource\Pages\CreateCollectionTranslation;
use App\Filament\Resources\CollectionTranslationResource\Pages\EditCollectionTranslation;
use App\Filament\Resources\CollectionTranslationResource\Pages\ListCollectionTranslation;
use App\Filament\Resources\CollectionTranslationResource\Pages\ViewCollectionTranslation;
use App\Filament\Resources\CollectionTranslationResource\RelationManagers\SiblingTranslationsRelationManager;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\TranslationFormSchema;
use App\Filament\Support\TranslationInfolistSchema;
use App\Models\CollectionTranslation;
use Filament\Forms\Components\MarkdownEditor;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rules\Unique;

class CollectionTranslationResource extends Resource
{
    use HasPlainTextRecordTitle;
    use HasTimestampsColumns;

    protected static ?string $model = CollectionTranslation::class;

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-language';

    protected static string | \UnitEnum | null $navigationGroup = 'Translations';

    protected static ?string $navigationLabel = 'Collection Translations';

    protected static ?int $navigationSort = 2;

    protected static ?string $recordTitleAttribute = 'title';

    public static function canViewAny(): bool
    {
        return auth()->user()?->can('viewAny', static::getModel()) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canViewAny();
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TranslationFormSchema::collectionSelectField(includeIdInSearch: true),
                Select::make('language_id')
                    ->label('Language')
                    ->relationship('language', 'internal_name')
                    ->searchable()
                    ->required()
                    ->unique(
                        table: 'collection_translations',
                        column: 'language_id',
                        modifyRuleUsing: fn (Unique $rule, Get $get, ?CollectionTranslation $record): Unique => $rule
                            ->where(fn (\Illuminate\Database\Query\Builder $q) => $q
                                ->where('collection_id', $get('collection_id'))
                                ->where('context_id', $get('context_id'))
                            )
                            ->ignore($record?->id),
                        ignoreRecord: true,
                    )
                    ->validationMessages(['unique' => 'A translation for this collection, language and context already exists.']),
                Select::make('context_id')
                    ->label('Context')
                    ->relationship('context', 'internal_name')
                    ->searchable()
                    ->required(),

                Section::make('Content')
                    ->schema([
                        TextInput::make('title')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('url')
                            ->url()
                            ->nullable()
                            ->maxLength(255),
                        MarkdownEditor::make('subtitle')
                            ->minHeight('4.5rem')
                            ->nullable()
                            ->columnSpanFull(),
                        MarkdownEditor::make('description')
                            ->minHeight('7.5rem')
                            ->columnSpanFull(),
                        MarkdownEditor::make('introduction')
                            ->helperText('The introduction, as written (Markdown).')
                            ->minHeight('10.5rem')
                            ->columnSpanFull(),
                        MarkdownEditor::make('quote')
                            ->placeholder('A representative quote or excerpt')
                            ->minHeight('6rem')
                            ->columnSpanFull(),
                        TextInput::make('duration')
                            ->placeholder('e.g., One day')
                            ->helperText('A trail\'s duration, as written.')
                            ->nullable()
                            ->maxLength(255),
                        MarkdownEditor::make('cover_caption')
                            ->label('Cover caption')
                            ->helperText('The cover picture\'s caption, as written.')
                            ->minHeight('6rem')
                            ->columnSpanFull(),
                    ])
                    ->columns(2),

                Section::make('Legacy & Metadata')
                    ->schema([
                        TranslationFormSchema::backwardCompatibilityField(),
                        TranslationFormSchema::extraField(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),
            ]);
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->inlineLabel()
            ->components([
                Section::make('Translation For')
                    ->schema([
                        TextEntry::make('collection.internal_name')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Collection')
                            ->url(fn (CollectionTranslation $record): ?string => $record->collection
                                ? (auth()->user()?->can('view', $record->collection) ? CollectionResource::getUrl('view', ['record' => $record->collection]) : null)
                                : null),
                        TextEntry::make('language.internal_name')
                            ->label('Language')
                            ->url(fn (CollectionTranslation $record): ?string => $record->language
                                ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                                : null),
                        TextEntry::make('context.internal_name')
                            ->label('Context')
                            ->url(fn (CollectionTranslation $record): ?string => $record->context
                                ? (auth()->user()?->can('view', $record->context) ? ContextResource::getUrl('view', ['record' => $record->context]) : null)
                                : null),
                    ])
                    ->columns(2),

                Section::make('Content')
                    ->schema([
                        TranslationInfolistSchema::rtlTextEntry('title'),
                        TextEntry::make('url'),
                        TranslationInfolistSchema::rtlTextEntry('subtitle'),
                        TranslationInfolistSchema::rtlTextEntry('duration'),
                        TranslationInfolistSchema::markdownEntry('cover_caption', 'Cover caption', columnSpanFull: true),
                        TranslationInfolistSchema::markdownEntry('description', columnSpanFull: true),
                        TranslationInfolistSchema::markdownEntry('introduction', columnSpanFull: true),
                        TranslationInfolistSchema::markdownEntry('quote', columnSpanFull: true),
                    ])
                    ->columns(2),

                Section::make('Extra Data')
                    ->schema([
                        TranslationInfolistSchema::extraEntry(),
                    ])
                    ->collapsible()
                    ->collapsed(),

                Section::make('System Information')
                    ->schema([
                        TextEntry::make('id')->label('UUID')->copyable(),
                        TextEntry::make('backward_compatibility')->label('Legacy code'),
                        ...static::timestampsInfolistEntries(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (CollectionTranslation $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with([
                'collection:id,internal_name',
                'language:id,internal_name,is_default',
                'context:id,internal_name,is_default',
            ]))
            ->columns([
                TextColumn::make('collection.internal_name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Collection')
                    ->sortable()
                    ->searchable(query: fn (Builder $query, string $search): Builder => $query
                        ->orWhereHas('collection', fn (Builder $q): Builder => $q
                            ->where('internal_name', 'like', "%{$search}%")
                            ->orWhere('id', 'like', "%{$search}%")
                            ->orWhere('backward_compatibility', 'like', "%{$search}%")
                        )
                    ),
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->badge()
                    ->color(fn (CollectionTranslation $r): string => $r->language?->is_default ? 'success' : 'gray')
                    ->searchable(query: fn (Builder $query, string $search): Builder => $query
                        ->orWhereHas('language', fn (Builder $q): Builder => $q
                            ->where('internal_name', 'like', "%{$search}%")
                            ->orWhere('id', 'like', "%{$search}%")
                        )
                    ),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->sortable()
                    ->badge()
                    ->color(fn (CollectionTranslation $r): string => $r->context?->is_default ? 'success' : 'gray')
                    ->searchable(query: fn (Builder $query, string $search): Builder => $query
                        ->orWhereHas('context', fn (Builder $q): Builder => $q
                            ->where('internal_name', 'like', "%{$search}%")
                            ->orWhere('id', 'like', "%{$search}%")
                        )
                    ),
                IconColumn::make('is_default_pair')
                    ->label('★')
                    ->tooltip('Default language + context pair')
                    ->getStateUsing(fn (CollectionTranslation $r): bool => (bool) ($r->language?->is_default && $r->context?->is_default))
                    ->trueIcon('heroicon-s-star')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('warning')
                    ->falseColor('gray'),
                TextColumn::make('title')
                    ->formatStateUsing(MarkdownState::inline())
                    ->searchable()
                    ->sortable(),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy ID')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('id')
                    ->label('UUID')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                ...static::timestampsColumns(),
            ])
            ->filters([
                SelectFilter::make('language_id')
                    ->label('Language')
                    ->relationship('language', 'internal_name')
                    ->searchable(),
                SelectFilter::make('context_id')
                    ->label('Context')
                    ->relationship('context', 'internal_name')
                    ->searchable(),
                Filter::make('default_language')
                    ->label('Default language only')
                    ->query(fn (Builder $query): Builder => $query->whereHas('language', fn (Builder $q): Builder => $q->where('is_default', true))),
                Filter::make('default_context')
                    ->label('Default context only')
                    ->query(fn (Builder $query): Builder => $query->whereHas('context', fn (Builder $q): Builder => $q->where('is_default', true))),
                Filter::make('is_default_pair')
                    ->label('Default pair only')
                    ->query(fn (Builder $query): Builder => $query
                        ->whereHas('language', fn (Builder $q): Builder => $q->where('is_default', true))
                        ->whereHas('context', fn (Builder $q): Builder => $q->where('is_default', true))
                    ),
                Filter::make('missing_fallback')
                    ->label('Owner missing default translation')
                    ->query(fn (Builder $query): Builder => $query->whereHas('collection', fn (Builder $cq): Builder => $cq->whereDoesntHave('translations', fn (Builder $tq): Builder => $tq
                        ->whereHas('language', fn (Builder $lq): Builder => $lq->where('is_default', true))
                        ->whereHas('context', fn (Builder $dq): Builder => $dq->where('is_default', true))
                    ))),
                Filter::make('recently_updated')
                    ->label('Recently updated (30 days)')
                    ->query(fn (Builder $query): Builder => $query->where('updated_at', '>=', now()->subDays(30))),
            ])
            ->recordActions([
                ViewAction::make(),
                Action::make('viewCollection')
                    ->label('View collection')
                    ->icon('heroicon-o-arrow-top-right-on-square')
                    ->url(fn (CollectionTranslation $r): string => CollectionResource::getUrl('view', ['record' => $r->collection_id]))
                    ->openUrlInNewTab(),
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            SiblingTranslationsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListCollectionTranslation::route('/'),
            'create' => CreateCollectionTranslation::route('/create'),
            'edit' => EditCollectionTranslation::route('/{record}/edit'),
            'view' => ViewCollectionTranslation::route('/{record}'),
        ];
    }
}
