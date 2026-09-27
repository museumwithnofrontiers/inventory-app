<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Support\RecordSelect;
use App\Models\Artist;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class ArtistsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

    protected static string $relationship = 'artists';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Artists';

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
                TextColumn::make('period_of_activity')
                    ->label('Period')
                    ->sortable()
                    ->toggleable(),
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
                $this->pivotAttachAction(RecordSelect::ARTISTS, []),
            ])
            ->actions([
                // Artist has no Filament Resource of its own (M7 story A2.4,
                // #1903), so — unlike TagsRelationManager's pivotViewAction(),
                // which navigates to TagResource — this is a plain ViewAction
                // opening a read-only modal built from Artist's own fields.
                // Filament's own default canView() (RelationManager::canView(),
                // untouched by AuthorizesRelationMutations) already allows
                // when a model has no policy of its own, which is the case
                // here.
                ViewAction::make()
                    ->modalHeading('Artist')
                    ->infolist(fn (Artist $record): array => [
                        TextEntry::make('name')->label('Name'),
                        TextEntry::make('internal_name')->label('Internal name'),
                        TextEntry::make('period_of_activity')->label('Period of activity'),
                        TextEntry::make('place_of_birth')->label('Place of birth'),
                        TextEntry::make('place_of_death')->label('Place of death'),
                        TextEntry::make('date_of_birth')->label('Date of birth'),
                        TextEntry::make('date_of_death')->label('Date of death'),
                        TextEntry::make('backward_compatibility')->label('Legacy code'),
                    ]),
                $this->pivotDetachAction(),
            ])
            ->bulkActions([
                $this->pivotDetachBulkAction(),
            ]);
    }
}
