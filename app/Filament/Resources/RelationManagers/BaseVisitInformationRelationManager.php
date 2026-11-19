<?php

namespace App\Filament\Resources\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Support\ExtraJsonField;
use App\Filament\Support\TranslationFormSchema;
use Filament\Forms\Components\Section;
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

/**
 * The visit information of an item (a monument), a collection (a travel
 * location) or a partner (M16 D1, #2645): per language and context, created
 * and edited in an inline modal. Every text is kept as written.
 *
 * Every mutation requires `update` on the owner and VisitInformation's own
 * policy (AuthorizesRelationMutations).
 */
abstract class BaseVisitInformationRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'visitInformation';

    protected static ?string $title = 'Visit information';

    protected static ?string $modelLabel = 'visit information';

    protected static ?string $pluralModelLabel = 'visit information';

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                TranslationFormSchema::languageField(),
                TranslationFormSchema::contextField(),
                Section::make('Getting there')
                    ->schema([
                        Textarea::make('how_to_reach')->label('How to reach')->rows(3)->columnSpanFull(),
                        Textarea::make('address')->rows(2),
                        Textarea::make('opening_hours')->label('Opening hours')->rows(2),
                        Textarea::make('practical_information')
                            ->label('Practical information')
                            ->helperText('Opening hours, fees, access, as legacy wrote them together.')
                            ->rows(4)
                            ->columnSpanFull(),
                    ])
                    ->columns(2),
                Section::make('Contact')
                    ->schema([
                        Textarea::make('institution')->rows(2),
                        Textarea::make('contact')->rows(2),
                        TextInput::make('phone'),
                        TextInput::make('fax'),
                        TextInput::make('email')->label('E-mail'),
                        TextInput::make('website'),
                    ])
                    ->columns(2),
                TranslationFormSchema::backwardCompatibilityField(),
                ExtraJsonField::formComponent(),
            ])
            ->columns(2);
    }

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with(['language:id,internal_name', 'context:id,internal_name']))
            ->defaultSort('language_id', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable(),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->sortable(),
                TextColumn::make('institution')
                    ->limit(40)
                    ->placeholder('—'),
                TextColumn::make('how_to_reach')
                    ->label('How to reach')
                    ->limit(60)
                    ->placeholder('—'),
                TextColumn::make('address')
                    ->limit(40)
                    ->placeholder('—')
                    ->toggleable(),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->searchable()
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
