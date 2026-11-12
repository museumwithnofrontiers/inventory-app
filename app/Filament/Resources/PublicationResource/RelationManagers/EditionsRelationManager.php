<?php

namespace App\Filament\Resources\PublicationResource\RelationManagers;

use App\Enums\PublicationFormat;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\LanguageResource;
use App\Filament\Support\ExtraJsonField;
use App\Models\PublicationEdition;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Form;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\CreateAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * A publication's editions. An edition has no Resource of its own, so it is
 * created and edited in an inline modal; every mutation requires `update`
 * on the publication (AuthorizesRelationMutations: PublicationEdition has no
 * policy of its own).
 */
class EditionsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'editions';

    protected static ?string $title = 'Editions';

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Select::make('language_id')
                    ->label('Language')
                    ->relationship('language', 'internal_name')
                    ->searchable()
                    ->required(),
                Select::make('format')
                    ->options(PublicationFormat::options())
                    ->required(),
                TextInput::make('edition')
                    ->numeric()
                    ->integer()
                    ->minValue(0)
                    ->nullable(),
                TextInput::make('publish_year')
                    ->label('Publish year')
                    ->numeric()
                    ->integer()
                    ->minValue(0)
                    ->maxValue(32767)
                    ->nullable(),
                TextInput::make('isbn')
                    ->label('ISBN')
                    ->maxLength(255)
                    ->nullable(),
                TextInput::make('publisher')
                    ->maxLength(255)
                    ->nullable(),
                TextInput::make('page_count')
                    ->label('Pages')
                    ->numeric()
                    ->integer()
                    ->minValue(0)
                    ->nullable(),
                TextInput::make('image_count')
                    ->label('Images')
                    ->numeric()
                    ->integer()
                    ->minValue(0)
                    ->nullable(),
                TextInput::make('plan_count')
                    ->label('Plans')
                    ->numeric()
                    ->integer()
                    ->minValue(0)
                    ->nullable(),
                TextInput::make('dimensions')
                    ->maxLength(255)
                    ->nullable(),
                TextInput::make('binding')
                    ->maxLength(255)
                    ->nullable(),
                TextInput::make('display_order')
                    ->label('Display order')
                    ->numeric()
                    ->integer()
                    ->nullable(),
                Toggle::make('visible')
                    ->default(true),
                ExtraJsonField::formComponent(),
            ])
            ->columns(2);
    }

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with(['language:id,internal_name']))
            ->defaultSort('display_order', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->url(fn (PublicationEdition $record): ?string => $record->language
                        ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                        : null),
                TextColumn::make('format')
                    ->badge()
                    ->formatStateUsing(fn (?PublicationFormat $state): ?string => $state?->label())
                    ->sortable(),
                TextColumn::make('edition')
                    ->sortable(),
                TextColumn::make('publish_year')
                    ->label('Year')
                    ->sortable(),
                TextColumn::make('isbn')
                    ->label('ISBN')
                    ->searchable(),
                TextColumn::make('publisher')
                    ->searchable()
                    ->toggleable(),
                IconColumn::make('visible')
                    ->boolean(),
                TextColumn::make('display_order')
                    ->label('Order')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('format')
                    ->options(PublicationFormat::options()),
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
