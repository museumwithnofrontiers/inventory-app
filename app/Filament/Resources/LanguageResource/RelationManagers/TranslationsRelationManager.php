<?php

namespace App\Filament\Resources\LanguageResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\LanguageResource;
use App\Models\Language;
use App\Models\LanguageTranslation;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\CreateAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class TranslationsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'translations';

    protected static ?string $recordTitleAttribute = 'name';

    protected static ?string $title = 'Translations (how this language is named)';

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Select::make('display_language_id')
                    ->label('Display language')
                    ->required()
                    ->getSearchResultsUsing(fn (string $search): array => Language::query()
                        ->where('internal_name', 'like', "%{$search}%")
                        ->orWhere('id', 'like', "%{$search}%")
                        ->orderBy('internal_name')
                        ->limit(50)
                        ->pluck('internal_name', 'id')
                        ->all()
                    )
                    ->getOptionLabelUsing(fn (mixed $value): string => is_string($value) ? (Language::find($value)->internal_name ?? $value) : '')
                    ->searchable(),
                TextInput::make('name')
                    ->required()
                    ->maxLength(255),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with(['displayLanguage:id,internal_name']))
            ->defaultSort('name', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('displayLanguage.internal_name')
                    ->label('Display language')
                    ->sortable()
                    ->url(fn (LanguageTranslation $record): ?string => $record->displayLanguage
                        ? (auth()->user()?->can('view', $record->displayLanguage) ? LanguageResource::getUrl('view', ['record' => $record->displayLanguage]) : null)
                        : null),
                TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
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
            ->headerActions([
                CreateAction::make(),
            ])
            ->actions([
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }
}
