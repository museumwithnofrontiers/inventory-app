<?php

namespace App\Filament\Resources\TimelineEventResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Support\TranslationFormSchema;
use App\Models\Language;
use App\Models\TimelineEvent;
use Filament\Forms\Components\Textarea;
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

class TranslationsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'translations';

    protected static ?string $recordTitleAttribute = 'name';

    protected static ?string $title = 'Translations';

    public function form(Form $form): Form
    {
        $ownerRecord = $this->ownerTimelineEvent();

        return $form
            ->schema([
                TranslationFormSchema::languageField()
                    ->unique(
                        table: 'timeline_event_translations',
                        column: 'language_id',
                        modifyRuleUsing: function (Unique $rule) use ($ownerRecord): Unique {
                            return $rule
                                ->where('timeline_event_id', $ownerRecord->id);
                        },
                        ignoreRecord: true,
                    )
                    ->validationMessages(['unique' => 'A translation for this language already exists.']),
                TextInput::make('name')
                    ->required()
                    ->maxLength(255),
                Textarea::make('description')
                    ->rows(4)
                    ->nullable()
                    ->columnSpanFull(),
                TextInput::make('date_from_description')
                    ->label('Date from description')
                    ->maxLength(255)
                    ->nullable(),
                TextInput::make('date_to_description')
                    ->label('Date to description')
                    ->maxLength(255)
                    ->nullable(),
                TextInput::make('date_from_ah_description')
                    ->label('Date from (AH) description')
                    ->maxLength(255)
                    ->nullable(),
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
            ]))
            ->defaultSort('name', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->badge(),
                TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
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

    private function ownerTimelineEvent(): TimelineEvent
    {
        /** @var TimelineEvent $record */
        $record = $this->ownerRecord;

        return $record;
    }
}
