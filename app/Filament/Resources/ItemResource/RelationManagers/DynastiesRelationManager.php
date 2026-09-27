<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Support\DynastyDisplayLabel;
use App\Filament\Support\RecordSelect;
use App\Models\Dynasty;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class DynastiesRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

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
                $this->pivotAttachAction(RecordSelect::DYNASTIES, []),
            ])
            ->actions([
                // Dynasty has no Filament Resource of its own (M7 story A2.4,
                // #1903) — see ArtistsRelationManager's row 'view' comment for
                // why a plain ViewAction (rather than pivotViewAction()) is
                // correct here and needs no extra authorization wiring.
                ViewAction::make()
                    ->modalHeading('Dynasty')
                    ->infolist(fn (Dynasty $record): array => [
                        TextEntry::make('display_label')->label('Dynasty'),
                        TextEntry::make('from_ad')->label('From (AD)'),
                        TextEntry::make('to_ad')->label('To (AD)'),
                        TextEntry::make('from_ah')->label('From (AH)'),
                        TextEntry::make('to_ah')->label('To (AH)'),
                        TextEntry::make('backward_compatibility')->label('Legacy code'),
                    ]),
                $this->pivotDetachAction(),
            ])
            ->bulkActions([
                $this->pivotDetachBulkAction(),
            ]);
    }
}
