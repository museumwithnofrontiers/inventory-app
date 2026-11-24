<?php

namespace App\Filament\Resources\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\ItemResource;
use App\Filament\Support\ItemDisplayLabel;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\RecordSelect;
use App\Models\Item;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * The items a piece of shared documentation (an artist, a dynasty) is linked
 * to: the other side of the item's own Artists and Dynasties managers, on the
 * pivot convention (Attach / View / Detach / bulk Detach). Neither pivot has
 * metadata, so there is no Edit.
 *
 * Attach and Detach need `update` on the host record (the artist or dynasty),
 * as every pivot manager does ({@see AuthorizesRelationMutations}).
 */
abstract class BaseLinkedItemsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

    protected static string $relationship = 'items';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Items';

    /**
     * The relation on Item that points back at the host record.
     */
    abstract protected function inverseRelationshipName(): string;

    public function table(Table $table): Table
    {
        return $table
            ->inverseRelationship($this->inverseRelationshipName())
            ->modifyQueryUsing(fn (Builder $query): Builder => ItemDisplayLabel::withDisplayLabel(
                $query->with([
                    'partner:id,internal_name',
                ])
            ))
            ->defaultSort('internal_name', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                ItemDisplayLabel::displayLabelColumn()
                    ->url(fn (Item $record): ?string => auth()->user()?->can('view', $record)
                        ? ItemResource::getUrl('view', ['record' => $record])
                        : null),
                TextColumn::make('type')
                    ->badge()
                    ->sortable(),
                TextColumn::make('partner.internal_name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Partner')
                    ->toggleable(),
                TextColumn::make('internal_name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->searchable()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->headerActions([
                $this->pivotAttachAction(RecordSelect::ITEMS, []),
            ])
            ->recordActions([
                $this->pivotViewAction(ItemResource::class),
                $this->pivotDetachAction(),
            ])
            ->toolbarActions([
                $this->pivotDetachBulkAction(),
            ]);
    }
}
