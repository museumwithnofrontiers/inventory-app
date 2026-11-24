<?php

namespace Tests\Filament\Fixtures;

use Filament\Schemas\Schema;
use Filament\Actions\CreateAction;
use Filament\Actions\EditAction;
use Filament\Actions\DeleteAction;
use Filament\Forms\Components\Textarea;
use Filament\Resources\RelationManagers\RelationManager;
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

    public function form(Schema $schema): Schema
    {
        return $schema->components([
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
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }
}
