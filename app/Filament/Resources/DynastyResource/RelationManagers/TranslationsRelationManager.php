<?php

namespace App\Filament\Resources\DynastyResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\TranslationFormSchema;
use App\Models\Dynasty;
use App\Models\Language;
use Filament\Forms\Components\MarkdownEditor;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\CreateAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rules\Unique;

/**
 * A dynasty's texts, one per language: its name, other names, area, history,
 * the AD and AH date texts, and the author and copy-editor credits. Dynasty
 * translations have no Resource of their own, so they are created and edited
 * here, in a modal, as Glossary's, TimelineEvent's and Contributor's are.
 *
 * Texts are kept as written (ADR 006): nothing is derived from the dates on
 * the dynasty, nor from the items' dynasty lines.
 */
class TranslationsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'translations';

    protected static ?string $recordTitleAttribute = 'name';

    protected static ?string $title = 'Translations';

    public function form(Form $form): Form
    {
        $ownerRecord = $this->ownerDynasty();

        return $form
            ->schema([
                TranslationFormSchema::languageField()
                    ->unique(
                        table: 'dynasty_translations',
                        column: 'language_id',
                        modifyRuleUsing: fn (Unique $rule): Unique => $rule->where('dynasty_id', $ownerRecord->id),
                        ignoreRecord: true,
                    )
                    ->validationMessages(['unique' => 'A translation for this language already exists.']),
                TextInput::make('name')
                    ->maxLength(255)
                    ->nullable(),
                TextInput::make('also_known_as')
                    ->label('Also known as')
                    ->maxLength(255)
                    ->nullable(),
                TextInput::make('date_description_ad')
                    ->label('Date description (AD)')
                    ->maxLength(255)
                    ->nullable(),
                TextInput::make('date_description_ah')
                    ->label('Date description (AH)')
                    ->maxLength(255)
                    ->nullable(),
                MarkdownEditor::make('area')
                    ->minHeight('6rem')
                    ->nullable()
                    ->columnSpanFull(),
                MarkdownEditor::make('history')
                    ->minHeight('13.5rem')
                    ->nullable()
                    ->columnSpanFull(),
                Section::make('Credits')
                    ->schema([
                        TranslationFormSchema::authorSelectField('author_id', 'Author'),
                        TranslationFormSchema::authorSelectField('text_copy_editor_id', 'Text copy editor'),
                        TranslationFormSchema::authorSelectField('translator_id', 'Translator'),
                        TranslationFormSchema::authorSelectField('translation_copy_editor_id', 'Translation copy editor'),
                    ])
                    ->columns(2),
                TextInput::make('backward_compatibility')
                    ->label('Legacy ID')
                    ->maxLength(255)
                    ->nullable(),
                TranslationFormSchema::extraField(),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with([
                'language:id,internal_name',
                'author:id,name',
            ]))
            ->defaultSort('language_id', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->badge(),
                TextColumn::make('name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->searchable()
                    ->sortable(),
                TextColumn::make('also_known_as')
                    ->label('Also known as')
                    ->formatStateUsing(MarkdownState::excerpt(60))
                    ->toggleable(),
                TextColumn::make('date_description_ad')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Dates (AD)')
                    ->toggleable(),
                TextColumn::make('author.name')
                    ->label('Author')
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy ID')
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('updated_at')
                    ->label('Updated')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->headerActions([
                CreateAction::make()
                    ->fillForm(fn (): array => [
                        'language_id' => Language::default()->first()?->id,
                    ]),
            ])
            ->actions([
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }

    private function ownerDynasty(): Dynasty
    {
        /** @var Dynasty $record */
        $record = $this->ownerRecord;

        return $record;
    }
}
