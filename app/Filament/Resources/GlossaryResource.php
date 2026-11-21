<?php

namespace App\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasPlainTextRecordTitle;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasTranslationCoverageFilters;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\GlossaryResource\Pages\CreateGlossary;
use App\Filament\Resources\GlossaryResource\Pages\EditGlossary;
use App\Filament\Resources\GlossaryResource\Pages\ListGlossary;
use App\Filament\Resources\GlossaryResource\Pages\ViewGlossary;
use App\Filament\Resources\GlossaryResource\RelationManagers\SpellingsRelationManager;
use App\Filament\Resources\GlossaryResource\RelationManagers\SynonymsRelationManager;
use App\Filament\Resources\GlossaryResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Support\MarkdownState;
use App\Models\Glossary;
use App\Models\Language;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Infolists\Components\Section as InfolistSection;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\Resource;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Filters\BaseFilter;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class GlossaryResource extends Resource
{
    use HasBackwardCompatibilityColumn;
    use HasInternalNameColumn;
    use HasPlainTextRecordTitle;
    use HasTimestampsColumns;
    use HasTranslationCoverageFilters;
    use HasUuidColumn;

    protected static ?string $model = Glossary::class;

    protected static ?string $navigationIcon = 'heroicon-o-book-open';

    protected static ?string $navigationGroup = 'Shared Data';

    protected static ?int $navigationSort = 4;

    protected static ?string $recordTitleAttribute = 'internal_name';

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'internal_name', 'backward_compatibility'];
    }

    public static function canViewAny(): bool
    {
        return auth()->user()?->hasPermissionTo(Permission::MANAGE_REFERENCE_DATA->value) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canViewAny();
    }

    /**
     * Glossary translations are language-only (no context_id column).
     * Override the shared withFallbackExists to check only the default language.
     */
    /**
     * @param  Builder<Glossary>  $query
     * @return Builder<Glossary>
     */
    protected static function withFallbackExists(Builder $query): Builder
    {
        return $query->withExists([
            'translations as has_fallback_translation' => fn (Builder $q): Builder => $q
                ->where('language_id', Language::default()->value('id')),
        ]);
    }

    /**
     * Glossary translations are language-only (no context_id column).
     * Override to exclude context-based filters that would produce SQL errors.
     */
    /**
     * @return array<int, BaseFilter>
     */
    protected static function translationCoverageFilters(): array
    {
        return [
            Filter::make('has_fallback_translation')
                ->label('Has fallback translation')
                ->query(fn (Builder $query): Builder => $query->whereHas(
                    'translations',
                    fn (Builder $q): Builder => $q
                        ->whereHas('language', fn (Builder $ql): Builder => $ql->where('is_default', true))
                )),

            Filter::make('missing_fallback_translation')
                ->label('Missing fallback translation')
                ->query(fn (Builder $query): Builder => $query->whereDoesntHave(
                    'translations',
                    fn (Builder $q): Builder => $q
                        ->whereHas('language', fn (Builder $ql): Builder => $ql->where('is_default', true))
                )),

            SelectFilter::make('translation_language_has')
                ->label('Has translation in language')
                ->getSearchResultsUsing(fn (string $search): array => Language::query()
                    ->where('internal_name', 'like', "%{$search}%")
                    ->orWhere('id', 'like', "%{$search}%")
                    ->orderBy('internal_name')
                    ->limit(50)
                    ->pluck('internal_name', 'id')
                    ->all())
                ->getOptionLabelUsing(fn (mixed $value): string => is_string($value) ? (Language::find($value)->internal_name ?? $value) : '')
                ->searchable()
                ->query(fn (Builder $query, array $data): Builder => $data['value']
                    ? $query->whereHas('translations', fn (Builder $q): Builder => $q->where('language_id', $data['value']))
                    : $query),

            SelectFilter::make('translation_language_missing')
                ->label('Missing translation in language')
                ->getSearchResultsUsing(fn (string $search): array => Language::query()
                    ->where('internal_name', 'like', "%{$search}%")
                    ->orWhere('id', 'like', "%{$search}%")
                    ->orderBy('internal_name')
                    ->limit(50)
                    ->pluck('internal_name', 'id')
                    ->all())
                ->getOptionLabelUsing(fn (mixed $value): string => is_string($value) ? (Language::find($value)->internal_name ?? $value) : '')
                ->searchable()
                ->query(fn (Builder $query, array $data): Builder => $data['value']
                    ? $query->whereDoesntHave('translations', fn (Builder $q): Builder => $q->where('language_id', $data['value']))
                    : $query),
        ];
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
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (Glossary $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->modifyQueryUsing(fn (Builder $query): Builder => static::withFallbackExists($query))
            ->defaultSort('internal_name', 'asc')
            ->columns([
                static::internalNameColumn()
                    ->searchable(['internal_name', 'id']),
                static::fallbackTranslationColumn(),
                static::backwardCompatibilityColumn(),
                static::uuidColumn(),
                ...static::timestampsColumns(),
            ])
            ->filters([
                ...static::translationCoverageFilters(),
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
                        TextEntry::make('internal_name')->formatStateUsing(MarkdownState::inline()),
                    ]),
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
            TranslationsRelationManager::class,
            SpellingsRelationManager::class,
            SynonymsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListGlossary::route('/'),
            'create' => CreateGlossary::route('/create'),
            'edit' => EditGlossary::route('/{record}/edit'),
            'view' => ViewGlossary::route('/{record}'),
        ];
    }
}
