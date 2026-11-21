<?php

namespace App\Filament\Resources\ContributorResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\TranslationFormSchema;
use App\Models\Context;
use App\Models\Contributor;
use App\Models\Language;
use Filament\Forms\Components\MarkdownEditor;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\CreateAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rules\Unique;

/**
 * A contributor's texts, one per language and context. Contributor
 * translations have no Resource of their own, so they are created and edited
 * here, in a modal (as TimelineEvent's). A collection credit's text is kept as
 * written: a name in `name`, a block (credits, a team) in `description`.
 */
class TranslationsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'translations';

    protected static ?string $recordTitleAttribute = 'name';

    protected static ?string $title = 'Translations';

    public function form(Form $form): Form
    {
        $ownerRecord = $this->ownerContributor();

        return $form
            ->schema([
                TranslationFormSchema::languageField()
                    ->unique(
                        table: 'contributor_translations',
                        column: 'language_id',
                        modifyRuleUsing: fn (Unique $rule, Get $get): Unique => $rule
                            ->where('contributor_id', $ownerRecord->id)
                            ->where('context_id', $get('context_id')),
                        ignoreRecord: true,
                    )
                    ->validationMessages(['unique' => 'A translation for this language and context already exists.']),
                TranslationFormSchema::contextField(),
                TextInput::make('name')
                    ->maxLength(255)
                    ->nullable(),
                MarkdownEditor::make('description')
                    ->minHeight('10.5rem')
                    ->nullable()
                    ->columnSpanFull(),
                TextInput::make('link')
                    ->url()
                    ->maxLength(255)
                    ->nullable(),
                TextInput::make('alt_text')
                    ->label('Alternative text')
                    ->maxLength(255)
                    ->nullable(),
                TextInput::make('backward_compatibility')
                    ->label('Legacy ID')
                    ->maxLength(255)
                    ->nullable(),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with([
                'language:id,internal_name',
                'context:id,internal_name',
            ]))
            ->defaultSort('language_id', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->badge(),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->toggleable(),
                TextColumn::make('name')
                    ->searchable()
                    ->formatStateUsing(MarkdownState::excerpt(60)),
                TextColumn::make('description')
                    ->formatStateUsing(MarkdownState::excerpt(60))
                    ->toggleable(),
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
                        'context_id' => Context::default()->first()?->id,
                    ]),
            ])
            ->actions([
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }

    private function ownerContributor(): Contributor
    {
        /** @var Contributor $record */
        $record = $this->ownerRecord;

        return $record;
    }
}
