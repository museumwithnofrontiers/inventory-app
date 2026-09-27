<?php

namespace App\Filament\Resources\ItemItemLinkResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\LanguageResource;
use App\Models\ItemItemLink;
use App\Models\ItemItemLinkTranslation;
use App\Models\Language;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\CreateAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rules\Unique;

class TranslationsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'translations';

    protected static ?string $recordTitleAttribute = 'language_id';

    protected static ?string $title = 'Translations';

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Select::make('language_id')
                    ->label('Language')
                    ->required()
                    ->searchable()
                    ->getSearchResultsUsing(fn (string $search): array => Language::query()
                        ->where('internal_name', 'like', "%{$search}%")
                        ->orderBy('internal_name')
                        ->limit(50)
                        ->pluck('internal_name', 'id')
                        ->all()
                    )
                    ->getOptionLabelUsing(fn (mixed $value): string => is_string($value) ? (Language::find($value)->internal_name ?? $value) : '')
                    ->unique(
                        table: 'item_item_link_translations',
                        column: 'language_id',
                        modifyRuleUsing: fn (Unique $rule, Get $get, ?ItemItemLinkTranslation $record): Unique => $rule
                            ->where('item_item_link_id', $this->ownerItemItemLink()->id)
                            ->ignore($record?->id),
                        ignoreRecord: true,
                    )
                    ->validationMessages(['unique' => 'A translation for this link and language already exists.']),
                Textarea::make('description')
                    ->label('Description (source → target)')
                    ->rows(3)
                    ->columnSpanFull(),
                Textarea::make('reciprocal_description')
                    ->label('Reciprocal description (target → source)')
                    ->rows(3)
                    ->columnSpanFull(),
                TextInput::make('backward_compatibility')
                    ->label('Legacy code')
                    ->maxLength(255),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with([
                'language:id,internal_name,is_default',
            ]))
            ->defaultSort('language_id', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->badge()
                    ->color(fn (ItemItemLinkTranslation $record): string => $record->language?->is_default ? 'success' : 'gray')
                    ->url(fn (ItemItemLinkTranslation $record): ?string => $record->language
                        ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                        : null),
                TextColumn::make('description')
                    ->label('Description')
                    ->limit(60)
                    ->tooltip(fn (ItemItemLinkTranslation $record): ?string => strlen((string) $record->description) > 60 ? $record->description : null),
                TextColumn::make('reciprocal_description')
                    ->label('Reciprocal description')
                    ->limit(60)
                    ->tooltip(fn (ItemItemLinkTranslation $record): ?string => strlen((string) $record->reciprocal_description) > 60 ? $record->reciprocal_description : null),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
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
            ->filters([
                SelectFilter::make('language_id')
                    ->label('Language')
                    ->relationship('language', 'internal_name')
                    ->searchable(),
            ])
            ->headerActions([
                CreateAction::make()
                    ->fillForm(fn (): array => [
                        'language_id' => Language::where('is_default', true)->first()?->id,
                    ]),
            ])
            ->actions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }

    private function ownerItemItemLink(): ItemItemLink
    {
        /** @var ItemItemLink $record */
        $record = $this->ownerRecord;

        return $record;
    }
}
