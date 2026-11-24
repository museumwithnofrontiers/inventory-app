<?php

namespace App\Filament\Resources\RelationManagers;

use Filament\Schemas\Schema;
use Filament\Schemas\Components\Section;
use Filament\Actions\CreateAction;
use Filament\Actions\EditAction;
use Filament\Actions\DeleteAction;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Support\ExtraJsonField;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\TranslationFormSchema;
use Filament\Forms\Components\MarkdownEditor;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
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

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TranslationFormSchema::languageField(),
                TranslationFormSchema::contextField(),
                Section::make('Getting there')
                    ->schema([
                        MarkdownEditor::make('how_to_reach')->label('How to reach')->minHeight('6rem')->columnSpanFull(),
                        MarkdownEditor::make('address')->minHeight('4.5rem'),
                        MarkdownEditor::make('opening_hours')->label('Opening hours')->minHeight('4.5rem'),
                        MarkdownEditor::make('practical_information')
                            ->label('Practical information')
                            ->helperText('Opening hours, fees, access, as legacy wrote them together.')
                            ->minHeight('7.5rem')
                            ->columnSpanFull(),
                    ])
                    ->columns(2),
                Section::make('Contact')
                    ->schema([
                        MarkdownEditor::make('institution')->minHeight('4.5rem'),
                        MarkdownEditor::make('contact')->minHeight('4.5rem'),
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
                    ->formatStateUsing(MarkdownState::excerpt(40))
                    ->placeholder('—'),
                TextColumn::make('how_to_reach')
                    ->label('How to reach')
                    ->formatStateUsing(MarkdownState::excerpt(60))
                    ->placeholder('—'),
                TextColumn::make('address')
                    ->formatStateUsing(MarkdownState::excerpt(40))
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
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }
}
