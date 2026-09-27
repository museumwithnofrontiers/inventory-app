<?php

namespace App\Filament\Resources\TimelineEventResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\ItemResource;
use App\Filament\Support\ItemDisplayLabel;
use App\Filament\Support\RecordSelect;
use App\Filament\Support\TimelineEventItemPivot;
use App\Models\Item;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class ItemsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

    protected static string $relationship = 'items';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Items';

    public function table(Table $table): Table
    {
        return $table
            ->inverseRelationship('timelineEvents')
            ->modifyQueryUsing(fn (Builder $query): Builder => ItemDisplayLabel::withDisplayLabel(
                $query->with([
                    'partner:id,internal_name',
                    'project:id,internal_name',
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
                TimelineEventItemPivot::displayOrderColumn(),
                TimelineEventItemPivot::backwardCompatibilityColumn(),
                TextColumn::make('internal_name')
                    ->searchable()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->headerActions([
                $this->pivotAttachAction(RecordSelect::ITEMS, TimelineEventItemPivot::pivotFormFields()),
            ])
            ->actions([
                $this->pivotViewAction(ItemResource::class),
                $this->pivotEditAction(TimelineEventItemPivot::pivotFormFields()),
                $this->pivotDetachAction(),
            ])
            ->bulkActions([
                $this->pivotDetachBulkAction(),
            ]);
    }
}
