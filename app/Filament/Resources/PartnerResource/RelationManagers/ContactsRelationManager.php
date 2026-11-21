<?php

namespace App\Filament\Resources\PartnerResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Support\MarkdownState;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\CreateAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

/**
 * A partner's contact persons (M16 D2, #2646), in legacy's order, created and
 * edited in an inline modal. Every field is kept as written.
 *
 * Every mutation requires `update` on the partner and PartnerContact's own
 * policy (AuthorizesRelationMutations).
 */
class ContactsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'contacts';

    protected static ?string $title = 'Contacts';

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                TextInput::make('display_order')
                    ->label('Order')
                    ->helperText('Legacy\'s order: contact person 1, 2…')
                    ->numeric()
                    ->integer()
                    ->minValue(1)
                    ->required(),
                Textarea::make('name')->rows(1),
                Textarea::make('title')->rows(1),
                Textarea::make('email')->label('E-mail')->rows(1),
                Textarea::make('phone')->rows(1),
                Textarea::make('fax')->rows(1),
                TextInput::make('backward_compatibility')
                    ->label('Legacy code')
                    ->maxLength(255),
            ])
            ->columns(2);
    }

    public function table(Table $table): Table
    {
        return $table
            ->defaultSort('display_order', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('display_order')
                    ->label('Order')
                    ->sortable(),
                TextColumn::make('name')
                    ->formatStateUsing(MarkdownState::excerpt(40))
                    ->placeholder('—'),
                TextColumn::make('title')
                    ->formatStateUsing(MarkdownState::excerpt(40))
                    ->placeholder('—'),
                TextColumn::make('email')
                    ->label('E-mail')
                    ->limit(40)
                    ->placeholder('—'),
                TextColumn::make('phone')
                    ->placeholder('—')
                    ->toggleable(),
                TextColumn::make('fax')
                    ->placeholder('—')
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
