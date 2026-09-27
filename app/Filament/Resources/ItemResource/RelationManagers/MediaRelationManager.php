<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Enums\MediaType;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\LanguageResource;
use App\Filament\Support\ExtraJsonField;
use App\Models\ItemMedia;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\CreateAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class MediaRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'itemMedia';

    protected static ?string $recordTitleAttribute = 'title';

    protected static ?string $title = 'Media';

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Select::make('type')
                    ->options(collect(MediaType::cases())->mapWithKeys(fn (MediaType $t) => [$t->value => $t->label()]))
                    ->required(),
                TextInput::make('url')
                    ->label('URL')
                    ->url()
                    ->required()
                    ->maxLength(2083)
                    ->columnSpanFull(),
                TextInput::make('title')
                    ->maxLength(255),
                Textarea::make('description')
                    ->rows(3)
                    ->columnSpanFull(),
                // Named 'language' rather than the 'language_id' column
                // TranslationFormSchema::languageField() uses: item_media.language_id
                // is nullable metadata (unlike a required *Translation language), and
                // the inline convention (#1908) targets a 'language' field name. The
                // relationship()-backed searchable select is otherwise the same idiom;
                // mapLanguageForSave()/mapLanguageForEdit() below bridge it to the
                // language_id column on save and on opening the edit form.
                Select::make('language')
                    ->label('Language')
                    ->relationship('language', 'internal_name')
                    ->searchable()
                    ->nullable(),
                TextInput::make('display_order')
                    ->label('Display order')
                    ->numeric()
                    ->integer()
                    ->default(0),
                ExtraJsonField::formComponent(),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with(['language:id,internal_name']))
            ->defaultSort('display_order', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('type')
                    ->badge()
                    ->formatStateUsing(fn (?MediaType $state): ?string => $state?->label())
                    ->sortable(),
                TextColumn::make('title')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('url')
                    ->label('URL')
                    ->url(fn (ItemMedia $record): string => $record->url)
                    ->openUrlInNewTab()
                    ->limit(60)
                    ->searchable(),
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->url(fn (ItemMedia $record): ?string => $record->language
                        ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                        : null),
                TextColumn::make('display_order')
                    ->label('Order')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('type')
                    ->options(collect(MediaType::cases())->mapWithKeys(fn (MediaType $t) => [$t->value => $t->label()])),
            ])
            ->headerActions([
                CreateAction::make()
                    ->mutateFormDataUsing(fn (array $data): array => $this->mapLanguageForSave($data)),
            ])
            ->actions([
                EditAction::make()
                    ->mutateRecordDataUsing(fn (array $data): array => $this->mapLanguageForEdit($data))
                    ->mutateFormDataUsing(fn (array $data): array => $this->mapLanguageForSave($data)),
                DeleteAction::make(),
            ]);
    }

    /**
     * Maps the form's 'language' field (see form()) onto the language_id
     * column before the record is created or updated.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function mapLanguageForSave(array $data): array
    {
        if (array_key_exists('language', $data)) {
            $data['language_id'] = $data['language'];
            unset($data['language']);
        }

        return $data;
    }

    /**
     * Populates the form's 'language' field from language_id when the Edit
     * modal opens.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function mapLanguageForEdit(array $data): array
    {
        $data['language'] = $data['language_id'] ?? null;

        return $data;
    }
}
