<?php

namespace Tests\Filament\Fixtures;

use Filament\Forms\Components\Textarea;
use Filament\Forms\Form;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\CreateAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

/**
 * A relation manager that deliberately doesn't use
 * AuthorizesRelationMutations, so a test can check Filament's panel-wide
 * default (read-only relation managers on a resource's View page) without
 * depending on which of the panel's real managers have adopted the concern.
 */
class GlossaryTranslationsWithoutConcernRelationManager extends RelationManager
{
    protected static string $relationship = 'translations';

    public function form(Form $form): Form
    {
        return $form->schema([
            Textarea::make('definition')->required(),
        ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('definition')
            ->columns([
                TextColumn::make('definition'),
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
