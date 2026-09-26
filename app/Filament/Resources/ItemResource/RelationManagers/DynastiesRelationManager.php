<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Support\DynastyDisplayLabel;
use App\Filament\Support\RecordSelect;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\AttachAction;
use Filament\Tables\Actions\DetachAction;
use Filament\Tables\Actions\DetachBulkAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class DynastiesRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'dynasties';

    protected static ?string $recordTitleAttribute = 'display_label';

    protected static ?string $title = 'Dynasties';

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => DynastyDisplayLabel::withDisplayLabel($query))
            ->defaultSort('from_ad', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                DynastyDisplayLabel::displayLabelColumn(),
                TextColumn::make('from_ad')
                    ->label('From (AD)')
                    ->sortable(),
                TextColumn::make('to_ad')
                    ->label('To (AD)')
                    ->sortable(),
                TextColumn::make('from_ah')
                    ->label('From (AH)')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('to_ah')
                    ->label('To (AH)')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->searchable()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->headerActions([
                RecordSelect::recordSelectFor(AttachAction::make(), RecordSelect::DYNASTIES),
            ])
            ->actions([
                DetachAction::make(),
            ])
            ->bulkActions([
                DetachBulkAction::make(),
            ]);
    }
}
