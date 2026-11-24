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
use App\Filament\Resources\ItemTranslationResource\Pages\CreateItemTranslation;
use App\Filament\Resources\ItemTranslationResource\Pages\EditItemTranslation;
use App\Filament\Resources\ItemTranslationResource\Pages\ListItemTranslation;
use App\Filament\Resources\ItemTranslationResource\Pages\ViewItemTranslation;
use App\Filament\Resources\ItemTranslationResource\RelationManagers\AuthorCreditsRelationManager;
use App\Filament\Resources\ItemTranslationResource\RelationManagers\SiblingTranslationsRelationManager;
use App\Filament\Resources\ItemTranslationResource\RelationManagers\TextCopyEditorCreditsRelationManager;
use App\Filament\Resources\ItemTranslationResource\RelationManagers\TranslationCopyEditorCreditsRelationManager;
use App\Filament\Resources\ItemTranslationResource\RelationManagers\TranslatorCreditsRelationManager;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\TranslationFormSchema;
use App\Filament\Support\TranslationInfolistSchema;
use App\Models\ItemTranslation;
use Filament\Forms\Components\MarkdownEditor;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Infolists\Components\IconEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\RelationManagers\RelationGroup;
use Filament\Resources\Resource;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rules\Unique;

class ItemTranslationResource extends Resource
{
    use HasPlainTextRecordTitle;
    use HasTimestampsColumns;

    protected static ?string $model = ItemTranslation::class;

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-language';

    protected static string | \UnitEnum | null $navigationGroup = 'Translations';

    protected static ?string $navigationLabel = 'Item Translations';

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'name';

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
                TranslationFormSchema::itemSelectField(includeIdInSearch: true),
                Select::make('language_id')
                    ->label('Language')
                    ->relationship('language', 'internal_name')
                    ->searchable()
                    ->required()
                    ->unique(
                        table: 'item_translations',
                        column: 'language_id',
                        modifyRuleUsing: fn (Unique $rule, Get $get, ?ItemTranslation $record): Unique => $rule
                            ->where(fn (\Illuminate\Database\Query\Builder $q) => $q
                                ->where('item_id', $get('item_id'))
                                ->where('context_id', $get('context_id'))
                            )
                            ->ignore($record?->id),
                        ignoreRecord: true,
                    )
                    ->validationMessages(['unique' => 'A translation for this item, language and context already exists.']),
                Select::make('context_id')
                    ->label('Context')
                    ->relationship('context', 'internal_name')
                    ->searchable()
                    ->required(),

                Toggle::make('draft')
                    ->helperText('Not ready for the sites: no site shows this text.')
                    ->default(true),

                Section::make('Basic Text')
                    ->schema([
                        TextInput::make('name')
                            ->required()
                            ->maxLength(255),
                        MarkdownEditor::make('alternate_name')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('description')
                            ->minHeight('7.5rem')
                            ->columnSpanFull(),
                        MarkdownEditor::make('short_description')
                            ->label('Short description')
                            ->helperText('A second, shorter text, as legacy wrote it')
                            ->minHeight('6rem')
                            ->columnSpanFull(),
                    ])
                    ->columns(2),

                Section::make('Object Details')
                    ->schema([
                        MarkdownEditor::make('type')
                            ->placeholder('e.g., painting, sculpture, monument')
                            ->minHeight('4.5rem'),
                        TextInput::make('dates')
                            ->placeholder('e.g., 1920–1930, 18th century')
                            ->maxLength(255),
                        TextInput::make('location')
                            ->placeholder('Current or original location')
                            ->maxLength(255),
                        TextInput::make('dimensions')
                            ->placeholder('e.g., 100×80 cm, 2 m height')
                            ->maxLength(255),
                        MarkdownEditor::make('materials')
                            ->placeholder('e.g., Bronze, cast and engraved')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('dynasty')
                            ->helperText('As the sheet prints it. The Dynasty links are on the item.')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('keywords')
                            ->helperText('As the sheet prints it. The Tags are on the item.')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('region')
                            ->placeholder('Region or province')
                            ->minHeight('4.5rem'),
                        TextInput::make('place_of_production')
                            ->label('Place of production')
                            ->placeholder('Where the item was created')
                            ->maxLength(255),
                        MarkdownEditor::make('holder')
                            ->placeholder('Current holder of the item')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('owner')
                            ->placeholder('Current owner of the item')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('initial_owner')
                            ->label('Initial owner')
                            ->placeholder('Original owner of the item')
                            ->minHeight('4.5rem'),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Research & Provenance')
                    ->schema([
                        MarkdownEditor::make('method_for_datation')
                            ->label('Method for datation')
                            ->placeholder('Method used to date the item')
                            ->minHeight('6rem'),
                        MarkdownEditor::make('method_for_provenance')
                            ->label('Method for provenance')
                            ->placeholder('Method used to determine provenance')
                            ->minHeight('6rem'),
                        MarkdownEditor::make('provenance')
                            ->placeholder('Provenance details')
                            ->minHeight('6rem'),
                        MarkdownEditor::make('obtention')
                            ->placeholder('How the item was obtained')
                            ->minHeight('6rem'),
                        MarkdownEditor::make('bibliography')
                            ->placeholder('Bibliographic references')
                            ->minHeight('7.5rem')
                            ->columnSpanFull(),
                        MarkdownEditor::make('catalogue_references')
                            ->label('Catalogue references')
                            ->helperText('As the sheet holds it: catalogue codes or citations. The Book links are on the item.')
                            ->minHeight('4.5rem')
                            ->columnSpanFull(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Monument')
                    ->schema([
                        MarkdownEditor::make('history')
                            ->placeholder('The history of the monument')
                            ->minHeight('9rem')
                            ->columnSpanFull(),
                    ])
                    ->collapsible()
                    ->collapsed(),

                Section::make('Artist')
                    ->description('The lines as the sheet prints them. The Artist links are on the item.')
                    ->schema([
                        MarkdownEditor::make('artist')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('artist_period_of_activity')
                            ->label('Period of activity')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('artist_birth_date')
                            ->label('Date of birth')
                            ->minHeight('3rem'),
                        MarkdownEditor::make('artist_birth_place')
                            ->label('Place of birth')
                            ->minHeight('3rem'),
                        MarkdownEditor::make('artist_death_date')
                            ->label('Date of death')
                            ->minHeight('3rem'),
                        MarkdownEditor::make('artist_death_place')
                            ->label('Place of death')
                            ->minHeight('3rem'),
                        MarkdownEditor::make('workshop')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('scribe')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('patrons')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('architects')
                            ->minHeight('4.5rem'),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Notices and rights')
                    ->description('As the sheet prints them.')
                    ->schema([
                        MarkdownEditor::make('notice')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('external_notice')
                            ->label('External notice')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('image_rights')
                            ->label('Image rights')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('external_sources')
                            ->label('External sources')
                            ->minHeight('6rem'),
                        MarkdownEditor::make('original_name')
                            ->label('Name in the original language')
                            ->minHeight('3rem'),
                        MarkdownEditor::make('holder_original_name')
                            ->label('Holding institution (original language)')
                            ->minHeight('3rem'),
                        MarkdownEditor::make('archival_reference')
                            ->label('Archival reference')
                            ->minHeight('4.5rem'),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Contributors')
                    ->schema([
                        TranslationFormSchema::authorSelectField('author_id', 'Author'),
                        MarkdownEditor::make('author_credit')
                            ->label('Author, as printed')
                            ->helperText('The credit line as the sheet prints it')
                            ->minHeight('4.5rem'),
                        TranslationFormSchema::authorSelectField('text_copy_editor_id', 'Text copy editor'),
                        MarkdownEditor::make('copy_editor_credit')
                            ->label('Text copy editor, as printed')
                            ->minHeight('4.5rem'),
                        TranslationFormSchema::authorSelectField('translator_id', 'Translator'),
                        MarkdownEditor::make('translator_credit')
                            ->label('Translator, as printed')
                            ->minHeight('4.5rem'),
                        TranslationFormSchema::authorSelectField('translation_copy_editor_id', 'Translation copy editor'),
                        MarkdownEditor::make('translation_copy_editor_credit')
                            ->label('Translation copy editor, as printed')
                            ->minHeight('4.5rem'),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

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
                        TextEntry::make('item.internal_name')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Item')
                            ->url(fn (ItemTranslation $record): ?string => $record->item
                                ? (auth()->user()?->can('view', $record->item) ? ItemResource::getUrl('view', ['record' => $record->item]) : null)
                                : null),
                        TextEntry::make('language.internal_name')
                            ->label('Language')
                            ->url(fn (ItemTranslation $record): ?string => $record->language
                                ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                                : null),
                        TextEntry::make('context.internal_name')
                            ->label('Context')
                            ->url(fn (ItemTranslation $record): ?string => $record->context
                                ? (auth()->user()?->can('view', $record->context) ? ContextResource::getUrl('view', ['record' => $record->context]) : null)
                                : null),
                        IconEntry::make('draft')
                            ->boolean(),
                    ])
                    ->columns(2),

                Section::make('Basic Text')
                    ->schema([
                        TranslationInfolistSchema::rtlTextEntry('name'),
                        TranslationInfolistSchema::rtlTextEntry('alternate_name', 'Alternate name'),
                        TranslationInfolistSchema::markdownEntry('description', columnSpanFull: true),
                        TranslationInfolistSchema::markdownEntry('short_description', 'Short description', columnSpanFull: true),
                    ])
                    ->columns(2),

                Section::make('Object Details')
                    ->schema([
                        TranslationInfolistSchema::rtlTextEntry('type'),
                        TranslationInfolistSchema::rtlTextEntry('dates'),
                        TranslationInfolistSchema::rtlTextEntry('location'),
                        TranslationInfolistSchema::rtlTextEntry('dimensions'),
                        TranslationInfolistSchema::markdownEntry('materials'),
                        TranslationInfolistSchema::markdownEntry('dynasty'),
                        TranslationInfolistSchema::markdownEntry('keywords'),
                        TranslationInfolistSchema::markdownEntry('region'),
                        TranslationInfolistSchema::rtlTextEntry('place_of_production', 'Place of production'),
                        TranslationInfolistSchema::markdownEntry('holder'),
                        TranslationInfolistSchema::markdownEntry('owner'),
                        TranslationInfolistSchema::markdownEntry('initial_owner', 'Initial owner'),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Research & Provenance')
                    ->schema([
                        TranslationInfolistSchema::markdownEntry('method_for_datation', 'Method for datation'),
                        TranslationInfolistSchema::markdownEntry('method_for_provenance', 'Method for provenance'),
                        TranslationInfolistSchema::markdownEntry('provenance'),
                        TranslationInfolistSchema::markdownEntry('obtention'),
                        TranslationInfolistSchema::markdownEntry('bibliography', columnSpanFull: true),
                        TranslationInfolistSchema::markdownEntry('catalogue_references', 'Catalogue references', columnSpanFull: true),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Monument')
                    ->schema([
                        TranslationInfolistSchema::markdownEntry('history', columnSpanFull: true),
                    ])
                    ->collapsible()
                    ->collapsed(),

                Section::make('Artist')
                    ->schema([
                        TranslationInfolistSchema::markdownEntry('artist'),
                        TranslationInfolistSchema::markdownEntry('artist_period_of_activity', 'Period of activity'),
                        TranslationInfolistSchema::markdownEntry('artist_birth_date', 'Date of birth'),
                        TranslationInfolistSchema::markdownEntry('artist_birth_place', 'Place of birth'),
                        TranslationInfolistSchema::markdownEntry('artist_death_date', 'Date of death'),
                        TranslationInfolistSchema::markdownEntry('artist_death_place', 'Place of death'),
                        TranslationInfolistSchema::markdownEntry('workshop'),
                        TranslationInfolistSchema::markdownEntry('scribe'),
                        TranslationInfolistSchema::markdownEntry('patrons'),
                        TranslationInfolistSchema::markdownEntry('architects'),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Notices and rights')
                    ->schema([
                        TranslationInfolistSchema::markdownEntry('notice'),
                        TranslationInfolistSchema::markdownEntry('external_notice', 'External notice'),
                        TranslationInfolistSchema::markdownEntry('image_rights', 'Image rights'),
                        TranslationInfolistSchema::markdownEntry('external_sources', 'External sources'),
                        TranslationInfolistSchema::markdownEntry('original_name', 'Name in the original language'),
                        TranslationInfolistSchema::markdownEntry('holder_original_name', 'Holding institution (original language)'),
                        TranslationInfolistSchema::markdownEntry('archival_reference', 'Archival reference'),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Contributors')
                    ->schema([
                        TextEntry::make('author.name')
                            ->label('Author')
                            ->url(fn (ItemTranslation $record): ?string => $record->author
                                ? (auth()->user()?->can('view', $record->author) ? AuthorResource::getUrl('view', ['record' => $record->author]) : null)
                                : null),
                        TextEntry::make('textCopyEditor.name')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Text copy editor')
                            ->url(fn (ItemTranslation $record): ?string => $record->textCopyEditor
                                ? (auth()->user()?->can('view', $record->textCopyEditor) ? AuthorResource::getUrl('view', ['record' => $record->textCopyEditor]) : null)
                                : null),
                        TextEntry::make('translator.name')
                            ->label('Translator')
                            ->url(fn (ItemTranslation $record): ?string => $record->translator
                                ? (auth()->user()?->can('view', $record->translator) ? AuthorResource::getUrl('view', ['record' => $record->translator]) : null)
                                : null),
                        TextEntry::make('translationCopyEditor.name')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Translation copy editor')
                            ->url(fn (ItemTranslation $record): ?string => $record->translationCopyEditor
                                ? (auth()->user()?->can('view', $record->translationCopyEditor) ? AuthorResource::getUrl('view', ['record' => $record->translationCopyEditor]) : null)
                                : null),
                        TranslationInfolistSchema::rtlTextEntry('author_credit', 'Author, as printed'),
                        TranslationInfolistSchema::rtlTextEntry('copy_editor_credit', 'Text copy editor, as printed'),
                        TranslationInfolistSchema::rtlTextEntry('translator_credit', 'Translator, as printed'),
                        TranslationInfolistSchema::rtlTextEntry('translation_copy_editor_credit', 'Translation copy editor, as printed'),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

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
            ->recordUrl(fn (ItemTranslation $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with([
                'item:id,internal_name',
                'language:id,internal_name,is_default',
                'context:id,internal_name,is_default',
            ]))
            ->columns([
                TextColumn::make('item.internal_name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Item')
                    ->sortable()
                    ->searchable(query: fn (Builder $query, string $search): Builder => $query
                        ->orWhereHas('item', fn (Builder $q): Builder => $q
                            ->where('internal_name', 'like', "%{$search}%")
                            ->orWhere('id', 'like', "%{$search}%")
                            ->orWhere('backward_compatibility', 'like', "%{$search}%")
                        )
                    ),
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->badge()
                    ->color(fn (ItemTranslation $r): string => $r->language?->is_default ? 'success' : 'gray')
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
                    ->color(fn (ItemTranslation $r): string => $r->context?->is_default ? 'success' : 'gray')
                    ->searchable(query: fn (Builder $query, string $search): Builder => $query
                        ->orWhereHas('context', fn (Builder $q): Builder => $q
                            ->where('internal_name', 'like', "%{$search}%")
                            ->orWhere('id', 'like', "%{$search}%")
                        )
                    ),
                IconColumn::make('draft')
                    ->boolean()
                    ->sortable(),
                IconColumn::make('is_default_pair')
                    ->label('★')
                    ->tooltip('Default language + context pair')
                    ->getStateUsing(fn (ItemTranslation $r): bool => (bool) ($r->language?->is_default && $r->context?->is_default))
                    ->trueIcon('heroicon-s-star')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('warning')
                    ->falseColor('gray'),
                TextColumn::make('name')
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
                TernaryFilter::make('draft')
                    ->label('Draft')
                    ->placeholder('All texts')
                    ->trueLabel('Drafts')
                    ->falseLabel('Ready for the sites'),
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
                    ->query(fn (Builder $query): Builder => $query->whereHas('item', fn (Builder $iq): Builder => $iq->whereDoesntHave('translations', fn (Builder $tq): Builder => $tq
                        ->whereHas('language', fn (Builder $lq): Builder => $lq->where('is_default', true))
                        ->whereHas('context', fn (Builder $cq): Builder => $cq->where('is_default', true))
                    ))),
                Filter::make('recently_updated')
                    ->label('Recently updated (30 days)')
                    ->query(fn (Builder $query): Builder => $query->where('updated_at', '>=', now()->subDays(30))),
            ])
            ->recordActions([
                ViewAction::make(),
                Action::make('viewItem')
                    ->label('View item')
                    ->icon('heroicon-o-arrow-top-right-on-square')
                    ->url(fn (ItemTranslation $r): string => ItemResource::getUrl('view', ['record' => $r->item_id]))
                    ->openUrlInNewTab(),
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            SiblingTranslationsRelationManager::class,
            RelationGroup::make('Credits', [
                AuthorCreditsRelationManager::class,
                TextCopyEditorCreditsRelationManager::class,
                TranslatorCreditsRelationManager::class,
                TranslationCopyEditorCreditsRelationManager::class,
            ]),
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListItemTranslation::route('/'),
            'create' => CreateItemTranslation::route('/create'),
            'edit' => EditItemTranslation::route('/{record}/edit'),
            'view' => ViewItemTranslation::route('/{record}'),
        ];
    }
}
