<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\DynastyResource;
use App\Filament\Support\DynastyDisplayLabel;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\RecordSelect;
use App\Models\Dynasty;
use Filament\Actions\ViewAction;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\RelationManagers\RelationManager;
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
                DynastyDisplayLabel::displayLabelColumn()
                    ->url(fn (Dynasty $record): ?string => self::dynastyUrl($record)),
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
            ->recordActions([
                // Opens DynastyResource's View page for a user who may open
                // it; anyone else allowed to view the dynasty keeps the
                // read-only modal. See ArtistsRelationManager's row 'view'.
                ViewAction::make()
                    ->url(fn (Dynasty $record): ?string => self::dynastyUrl($record))
                    ->modalHeading('Dynasty')
                    ->schema(fn (Dynasty $record): array => [
                        TextEntry::make('display_label')->formatStateUsing(MarkdownState::inline())->label('Dynasty'),
                        TextEntry::make('from_ad')->label('From (AD)'),
                        TextEntry::make('to_ad')->label('To (AD)'),
                        TextEntry::make('from_ah')->label('From (AH)'),
                        TextEntry::make('to_ah')->label('To (AH)'),
                        TextEntry::make('backward_compatibility')->label('Legacy code'),
                    ]),
                $this->pivotDetachAction(),
            ])
            ->toolbarActions([
                $this->pivotDetachBulkAction(),
            ]);
    }

    /**
     * The dynasty's View page, when the signed-in user may open it.
     */
    private static function dynastyUrl(Dynasty $record): ?string
    {
        return DynastyResource::canAccess() && DynastyResource::canView($record)
            ? DynastyResource::getUrl('view', ['record' => $record])
            : null;
    }
}
