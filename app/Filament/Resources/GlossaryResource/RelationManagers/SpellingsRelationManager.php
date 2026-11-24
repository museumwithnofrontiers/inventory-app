<?php

namespace App\Filament\Resources\GlossaryResource\RelationManagers;

use Filament\Schemas\Schema;
use Filament\Actions\CreateAction;
use Filament\Actions\EditAction;
use Filament\Actions\DeleteAction;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\LanguageResource;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\TranslationFormSchema;
use App\Models\GlossarySpelling;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class SpellingsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'spellings';

    protected static ?string $recordTitleAttribute = 'spelling';

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TranslationFormSchema::languageField(),
                TextInput::make('spelling')
                    ->required()
                    ->maxLength(255),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('spelling')
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with(['language:id,internal_name']))
            ->defaultSort('spelling', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->url(fn (GlossarySpelling $record): ?string => $record->language
                        ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                        : null),
                TextColumn::make('spelling')
                    ->formatStateUsing(MarkdownState::inline())
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
                CreateAction::make(),
            ])
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }
}
