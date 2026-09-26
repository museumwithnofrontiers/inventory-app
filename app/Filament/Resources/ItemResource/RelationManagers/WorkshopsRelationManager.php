<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Support\RecordSelect;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\AttachAction;
use Filament\Tables\Actions\DetachAction;
use Filament\Tables\Actions\DetachBulkAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class WorkshopsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'workshops';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Workshops';

    public function table(Table $table): Table
    {
        return $table
            ->defaultSort('internal_name', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('name')
                    ->label('Name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('internal_name')
                    ->searchable()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->headerActions([
                RecordSelect::recordSelectFor(AttachAction::make(), RecordSelect::WORKSHOPS),
            ])
            ->actions([
                DetachAction::make(),
            ])
            ->bulkActions([
                DetachBulkAction::make(),
            ]);
    }
}
