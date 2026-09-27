<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\TimelineEventResource;
use App\Filament\Resources\TimelineResource;
use App\Filament\Support\RecordSelect;
use App\Filament\Support\TimelineEventDisplayLabel;
use App\Filament\Support\TimelineEventItemPivot;
use App\Models\TimelineEvent;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class TimelineEventsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

    protected static string $relationship = 'timelineEvents';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Timeline events';

    public function table(Table $table): Table
    {
        return $table
            ->inverseRelationship('items')
            ->modifyQueryUsing(fn (Builder $query): Builder => TimelineEventDisplayLabel::withDisplayLabel(
                $query->with([
                    'timeline:id,internal_name',
                ])
            ))
            ->defaultSort('timeline.internal_name', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('timeline.internal_name')
                    ->label('Timeline')
                    ->sortable()
                    ->url(fn (TimelineEvent $record): ?string => $record->timeline && auth()->user()?->can('view', $record->timeline)
                        ? TimelineResource::getUrl('view', ['record' => $record->timeline])
                        : null),
                TimelineEventDisplayLabel::displayLabelColumn()
                    ->label('Event')
                    ->url(fn (TimelineEvent $record): ?string => auth()->user()?->can('view', $record)
                        ? TimelineEventResource::getUrl('view', ['record' => $record])
                        : null),
                TextColumn::make('year_from')
                    ->label('Year from')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('year_to')
                    ->label('Year to')
                    ->sortable()
                    ->toggleable(),
                TimelineEventItemPivot::displayOrderColumn(),
                TimelineEventItemPivot::backwardCompatibilityColumn(),
                TextColumn::make('internal_name')
                    ->label('Internal name')
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
                $this->pivotAttachAction(RecordSelect::TIMELINE_EVENTS, TimelineEventItemPivot::pivotFormFields()),
            ])
            ->actions([
                $this->pivotViewAction(TimelineEventResource::class),
                $this->pivotEditAction(TimelineEventItemPivot::pivotFormFields()),
                $this->pivotDetachAction(),
            ])
            ->bulkActions([
                $this->pivotDetachBulkAction(),
            ]);
    }
}
