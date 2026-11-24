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
use App\Filament\Resources\PublicationTranslationResource\Pages\CreatePublicationTranslation;
use App\Filament\Resources\PublicationTranslationResource\Pages\EditPublicationTranslation;
use App\Filament\Resources\PublicationTranslationResource\Pages\ListPublicationTranslation;
use App\Filament\Resources\PublicationTranslationResource\Pages\ViewPublicationTranslation;
use App\Filament\Resources\PublicationTranslationResource\RelationManagers\SiblingTranslationsRelationManager;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\RecordSelect;
use App\Filament\Support\TranslationFormSchema;
use App\Filament\Support\TranslationInfolistSchema;
use App\Models\PublicationTranslation;
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

class PublicationTranslationResource extends Resource
{
    use HasPlainTextRecordTitle;
    use HasTimestampsColumns;

    protected static ?string $model = PublicationTranslation::class;

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-language';

    protected static string | \UnitEnum | null $navigationGroup = 'Translations';

    protected static ?string $navigationLabel = 'Publication Translations';

    protected static ?int $navigationSort = 4;

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
                RecordSelect::forPublications(),
                Select::make('language_id')
                    ->label('Language')
                    ->relationship('language', 'internal_name')
                    ->searchable()
                    ->required()
                    ->unique(
                        table: 'publication_translations',
                        column: 'language_id',
                        modifyRuleUsing: fn (Unique $rule, Get $get, ?PublicationTranslation $record): Unique => $rule
                            ->where(fn (\Illuminate\Database\Query\Builder $q) => $q
                                ->where('publication_id', $get('publication_id'))
                                ->where('context_id', $get('context_id'))
                            )
                            ->ignore($record?->id),
                        ignoreRecord: true,
                    )
                    ->validationMessages(['unique' => 'A translation for this publication, language and context already exists.']),
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
                        TextInput::make('subtitle')
                            ->maxLength(255)
                            ->nullable(),
                        MarkdownEditor::make('description')
                            ->helperText('About this publication (Markdown).')
                            ->minHeight('7.5rem')
                            ->columnSpanFull(),
                        MarkdownEditor::make('introduction')
                            ->helperText('More about this publication (Markdown).')
                            ->minHeight('7.5rem')
                            ->columnSpanFull(),
                    ])
                    ->columns(2),

                Section::make('Credits')
                    ->description('The credit lines as printed.')
                    ->schema([
                        MarkdownEditor::make('author_credit')
                            ->label('Author credit')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('photography_credit')
                            ->label('Photography credit')
                            ->minHeight('4.5rem'),
                        MarkdownEditor::make('coordination_credit')
                            ->label('Coordination credit')
                            ->minHeight('4.5rem'),
                    ])
                    ->columns(3),

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
                        TextEntry::make('publication.internal_name')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Publication')
                            ->url(fn (PublicationTranslation $record): ?string => $record->publication
                                ? (auth()->user()?->can('view', $record->publication) ? PublicationResource::getUrl('view', ['record' => $record->publication]) : null)
                                : null),
                        TextEntry::make('language.internal_name')
                            ->label('Language')
                            ->url(fn (PublicationTranslation $record): ?string => $record->language
                                ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                                : null),
                        TextEntry::make('context.internal_name')
                            ->label('Context')
                            ->url(fn (PublicationTranslation $record): ?string => $record->context
                                ? (auth()->user()?->can('view', $record->context) ? ContextResource::getUrl('view', ['record' => $record->context]) : null)
                                : null),
                    ])
                    ->columns(2),

                Section::make('Content')
                    ->schema([
                        TranslationInfolistSchema::rtlTextEntry('title'),
                        TranslationInfolistSchema::rtlTextEntry('subtitle'),
                        TranslationInfolistSchema::markdownEntry('description', columnSpanFull: true),
                        TranslationInfolistSchema::markdownEntry('introduction', columnSpanFull: true),
                    ])
                    ->columns(2),

                Section::make('Credits')
                    ->schema([
                        TranslationInfolistSchema::rtlTextEntry('author_credit', 'Author credit'),
                        TranslationInfolistSchema::rtlTextEntry('photography_credit', 'Photography credit'),
                        TranslationInfolistSchema::rtlTextEntry('coordination_credit', 'Coordination credit'),
                    ]),

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
            ->recordUrl(fn (PublicationTranslation $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with([
                'publication:id,internal_name',
                'language:id,internal_name,is_default',
                'context:id,internal_name,is_default',
            ]))
            ->columns([
                TextColumn::make('publication.internal_name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Publication')
                    ->sortable()
                    ->searchable(query: fn (Builder $query, string $search): Builder => $query
                        ->orWhereHas('publication', fn (Builder $q): Builder => $q
                            ->where('internal_name', 'like', "%{$search}%")
                            ->orWhere('id', 'like', "%{$search}%")
                            ->orWhere('backward_compatibility', 'like', "%{$search}%")
                        )
                    ),
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->badge()
                    ->color(fn (PublicationTranslation $r): string => $r->language?->is_default ? 'success' : 'gray'),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->sortable()
                    ->badge()
                    ->color(fn (PublicationTranslation $r): string => $r->context?->is_default ? 'success' : 'gray'),
                IconColumn::make('is_default_pair')
                    ->label('★')
                    ->tooltip('Default language + context pair')
                    ->getStateUsing(fn (PublicationTranslation $r): bool => (bool) ($r->language?->is_default && $r->context?->is_default))
                    ->trueIcon('heroicon-s-star')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('warning')
                    ->falseColor('gray'),
                TextColumn::make('title')
                    ->formatStateUsing(MarkdownState::inline())
                    ->searchable()
                    ->sortable(),
                TextColumn::make('subtitle')
                    ->formatStateUsing(MarkdownState::inline())
                    ->toggleable(isToggledHiddenByDefault: true),
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
                Filter::make('is_default_pair')
                    ->label('Default pair only')
                    ->query(fn (Builder $query): Builder => $query
                        ->whereHas('language', fn (Builder $q): Builder => $q->where('is_default', true))
                        ->whereHas('context', fn (Builder $q): Builder => $q->where('is_default', true))
                    ),
            ])
            ->recordActions([
                ViewAction::make(),
                Action::make('viewPublication')
                    ->label('View publication')
                    ->icon('heroicon-o-arrow-top-right-on-square')
                    ->url(fn (PublicationTranslation $r): string => PublicationResource::getUrl('view', ['record' => $r->publication_id]))
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
            'index' => ListPublicationTranslation::route('/'),
            'create' => CreatePublicationTranslation::route('/create'),
            'edit' => EditPublicationTranslation::route('/{record}/edit'),
            'view' => ViewPublicationTranslation::route('/{record}'),
        ];
    }
}
