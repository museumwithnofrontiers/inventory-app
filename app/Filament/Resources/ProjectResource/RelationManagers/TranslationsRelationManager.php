<?php

namespace App\Filament\Resources\ProjectResource\RelationManagers;

use Filament\Schemas\Schema;
use Filament\Actions\CreateAction;
use Filament\Actions\EditAction;
use Filament\Actions\DeleteAction;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\TranslationFormSchema;
use App\Models\Language;
use App\Models\Project;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rules\Unique;

/**
 * A project's name, one per language, as the sites print it (a record's
 * source chip). Project translations have no Resource of their own, so they
 * are created and edited here, in a modal, as Dynasty's and Contributor's are.
 */
class TranslationsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'translations';

    protected static ?string $recordTitleAttribute = 'name';

    protected static ?string $title = 'Translations';

    public function form(Schema $schema): Schema
    {
        $ownerRecord = $this->ownerProject();

        return $schema
            ->components([
                TranslationFormSchema::languageField()
                    ->unique(
                        table: 'project_translations',
                        column: 'language_id',
                        modifyRuleUsing: fn (Unique $rule): Unique => $rule->where('project_id', $ownerRecord->id),
                        ignoreRecord: true,
                    )
                    ->validationMessages(['unique' => 'A translation for this language already exists.']),
                TextInput::make('name')
                    ->required()
                    ->maxLength(255),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with([
                'language:id,internal_name',
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
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }

    private function ownerProject(): Project
    {
        /** @var Project $record */
        $record = $this->ownerRecord;

        return $record;
    }
}
