<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Support\RecordSelect;
use App\Models\Workshop;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class WorkshopsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

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
                $this->pivotAttachAction(RecordSelect::WORKSHOPS, []),
            ])
            ->actions([
                // Workshop has no Filament Resource of its own (M7 story A2.4,
                // #1903) — see ArtistsRelationManager's row 'view' comment for
                // why a plain ViewAction (rather than pivotViewAction()) is
                // correct here and needs no extra authorization wiring.
                ViewAction::make()
                    ->modalHeading('Workshop')
                    ->infolist(fn (Workshop $record): array => [
                        TextEntry::make('name')->label('Name'),
                        TextEntry::make('internal_name')->label('Internal name'),
                        TextEntry::make('backward_compatibility')->label('Legacy code'),
                    ]),
                $this->pivotDetachAction(),
            ])
            ->bulkActions([
                $this->pivotDetachBulkAction(),
            ]);
    }
}
