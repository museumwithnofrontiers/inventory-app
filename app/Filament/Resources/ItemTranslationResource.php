<?php

namespace App\Filament\Resources;

use App\Enums\Permission;
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
use App\Filament\Support\TranslationFormSchema;
use App\Filament\Support\TranslationInfolistSchema;
use App\Models\ItemTranslation;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Infolists\Components\Section as InfolistSection;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\RelationManagers\RelationGroup;
use Filament\Resources\Resource;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rules\Unique;

class ItemTranslationResource extends Resource
{
    use HasTimestampsColumns;

    protected static ?string $model = ItemTranslation::class;

    protected static ?string $navigationIcon = 'heroicon-o-language';

    protected static ?string $navigationGroup = 'Translations';

    protected static ?string $navigationLabel = 'Item Translations';

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'name';

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

                Section::make('Basic Text')
                    ->schema([
                        TextInput::make('name')
                            ->required()
                            ->maxLength(255),
                        Textarea::make('alternate_name')
                            ->rows(2),
                        Textarea::make('description')
                            ->rows(4)
                            ->columnSpanFull(),
                    ])
                    ->columns(2),

                Section::make('Object Details')
                    ->schema([
                        Textarea::make('type')
                            ->placeholder('e.g., painting, sculpture, monument')
                            ->rows(2),
                        TextInput::make('dates')
                            ->placeholder('e.g., 1920–1930, 18th century')
                            ->maxLength(255),
                        TextInput::make('location')
                            ->placeholder('Current or original location')
                            ->maxLength(255),
                        TextInput::make('dimensions')
                            ->placeholder('e.g., 100×80 cm, 2 m height')
                            ->maxLength(255),
                        TextInput::make('place_of_production')
                            ->label('Place of production')
                            ->placeholder('Where the item was created')
                            ->maxLength(255),
                        Textarea::make('holder')
                            ->placeholder('Current holder of the item')
                            ->rows(2),
                        Textarea::make('owner')
                            ->placeholder('Current owner of the item')
                            ->rows(2),
                        Textarea::make('initial_owner')
                            ->label('Initial owner')
                            ->placeholder('Original owner of the item')
                            ->rows(2),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Research & Provenance')
                    ->schema([
                        Textarea::make('method_for_datation')
                            ->label('Method for datation')
                            ->placeholder('Method used to date the item')
                            ->rows(3),
                        Textarea::make('method_for_provenance')
                            ->label('Method for provenance')
                            ->placeholder('Method used to determine provenance')
                            ->rows(3),
                        Textarea::make('provenance')
                            ->placeholder('Provenance details')
                            ->rows(3),
                        Textarea::make('obtention')
                            ->placeholder('How the item was obtained')
                            ->rows(3),
                        Textarea::make('bibliography')
                            ->placeholder('Bibliographic references')
                            ->rows(4)
                            ->columnSpanFull(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Contributors')
                    ->schema([
                        TranslationFormSchema::authorSelectField('author_id', 'Author'),
                        TranslationFormSchema::authorSelectField('text_copy_editor_id', 'Text copy editor'),
                        TranslationFormSchema::authorSelectField('translator_id', 'Translator'),
                        TranslationFormSchema::authorSelectField('translation_copy_editor_id', 'Translation copy editor'),
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

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->inlineLabel()
            ->schema([
                InfolistSection::make('Translation For')
                    ->schema([
                        TextEntry::make('item.internal_name')
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
                    ])
                    ->columns(2),

                InfolistSection::make('Basic Text')
                    ->schema([
                        TranslationInfolistSchema::rtlTextEntry('name'),
                        TranslationInfolistSchema::rtlTextEntry('alternate_name', 'Alternate name'),
                        TranslationInfolistSchema::markdownEntry('description', columnSpanFull: true),
                    ])
                    ->columns(2),

                InfolistSection::make('Object Details')
                    ->schema([
                        TranslationInfolistSchema::rtlTextEntry('type'),
                        TranslationInfolistSchema::rtlTextEntry('dates'),
                        TranslationInfolistSchema::rtlTextEntry('location'),
                        TranslationInfolistSchema::rtlTextEntry('dimensions'),
                        TranslationInfolistSchema::rtlTextEntry('place_of_production', 'Place of production'),
                        TranslationInfolistSchema::markdownEntry('holder'),
                        TranslationInfolistSchema::markdownEntry('owner'),
                        TranslationInfolistSchema::markdownEntry('initial_owner', 'Initial owner'),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                InfolistSection::make('Research & Provenance')
                    ->schema([
                        TranslationInfolistSchema::markdownEntry('method_for_datation', 'Method for datation'),
                        TranslationInfolistSchema::markdownEntry('method_for_provenance', 'Method for provenance'),
                        TranslationInfolistSchema::markdownEntry('provenance'),
                        TranslationInfolistSchema::markdownEntry('obtention'),
                        TranslationInfolistSchema::markdownEntry('bibliography', columnSpanFull: true),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                InfolistSection::make('Contributors')
                    ->schema([
                        TextEntry::make('author.name')
                            ->label('Author')
                            ->url(fn (ItemTranslation $record): ?string => $record->author
                                ? (auth()->user()?->can('view', $record->author) ? AuthorResource::getUrl('view', ['record' => $record->author]) : null)
                                : null),
                        TextEntry::make('textCopyEditor.name')
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
                            ->label('Translation copy editor')
                            ->url(fn (ItemTranslation $record): ?string => $record->translationCopyEditor
                                ? (auth()->user()?->can('view', $record->translationCopyEditor) ? AuthorResource::getUrl('view', ['record' => $record->translationCopyEditor]) : null)
                                : null),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                InfolistSection::make('Extra Data')
                    ->schema([
                        TranslationInfolistSchema::extraEntry(),
                    ])
                    ->collapsible()
                    ->collapsed(),

                InfolistSection::make('System Information')
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
                IconColumn::make('is_default_pair')
                    ->label('★')
                    ->tooltip('Default language + context pair')
                    ->getStateUsing(fn (ItemTranslation $r): bool => (bool) ($r->language?->is_default && $r->context?->is_default))
                    ->trueIcon('heroicon-s-star')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('warning')
                    ->falseColor('gray'),
                TextColumn::make('name')
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
                    ->query(fn (Builder $query): Builder => $query->whereHas('item', fn (Builder $iq): Builder => $iq->whereDoesntHave('translations', fn (Builder $tq): Builder => $tq
                        ->whereHas('language', fn (Builder $lq): Builder => $lq->where('is_default', true))
                        ->whereHas('context', fn (Builder $cq): Builder => $cq->where('is_default', true))
                    ))),
                Filter::make('recently_updated')
                    ->label('Recently updated (30 days)')
                    ->query(fn (Builder $query): Builder => $query->where('updated_at', '>=', now()->subDays(30))),
            ])
            ->actions([
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
