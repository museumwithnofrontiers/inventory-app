<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\ArtistResource;
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
                    ->sortable()
                    ->url(fn (Artist $record): ?string => self::artistUrl($record)),
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
                // Like TagsRelationManager's pivotViewAction(), this opens
                // ArtistResource's View page, for a user who may open that
                // resource (`manage-reference-data`). Anyone else allowed to
                // view the artist (ArtistPolicy: `view data`) keeps the
                // read-only modal they had before ArtistResource existed.
                ViewAction::make()
                    ->url(fn (Artist $record): ?string => self::artistUrl($record))
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

    /**
     * The artist's View page, when the signed-in user may open it.
     */
    private static function artistUrl(Artist $record): ?string
    {
        return ArtistResource::canAccess() && ArtistResource::canView($record)
            ? ArtistResource::getUrl('view', ['record' => $record])
            : null;
    }
}
