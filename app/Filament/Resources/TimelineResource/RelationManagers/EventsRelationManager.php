<?php

namespace App\Filament\Resources\TimelineResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\TimelineEventResource;
use App\Filament\Support\ResourceCreateUrl;
use App\Models\TimelineEvent;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

/**
 * M7 story A5.4 (#2090): the has-many convention adapted for a required
 * parent. `TimelineEvent belongsTo Timeline` / `Timeline hasMany
 * TimelineEvent`, but `timeline_events.timeline_id` is NOT NULL
 * (`onDelete('cascade')`), so an event always belongs to exactly one
 * timeline. Pascal decided (2026-09-27) there is no `Attach existing` and no
 * `Detach` here — an event is moved to another timeline via its own Edit
 * form, not through this manager.
 *
 * Header: `Create` (a URL action navigating to TimelineEventResource's
 * Create page, `timeline_id` pre-filled via {@see ResourceCreateUrl}). Row:
 * `View` · `Edit` (both navigate to TimelineEventResource's pages) ·
 * `Delete`. No bulk action.
 */
class EventsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'events';

    protected static ?string $recordTitleAttribute = 'internal_name';

    public function table(Table $table): Table
    {
        return $table
            ->defaultSort('display_order', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('internal_name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('year_from')
                    ->label('Year from')
                    ->sortable(),
                TextColumn::make('year_to')
                    ->label('Year to')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('display_order')
                    ->label('Order')
                    ->sortable(),
                TextColumn::make('date_from')
                    ->label('Date from')
                    ->date()
                    ->toggleable(),
                TextColumn::make('date_to')
                    ->label('Date to')
                    ->date()
                    ->toggleable(),
            ])
            ->headerActions([
                Action::make('create')
                    ->label('Create')
                    ->icon('heroicon-o-plus')
                    ->url(fn (): string => ResourceCreateUrl::for(TimelineEventResource::class, [
                        'timeline_id' => $this->getOwnerRecord()->getKey(),
                    ]))
                    ->visible(fn (): bool => $this->canCreate()),
            ])
            ->actions([
                ViewAction::make()
                    ->url(fn (TimelineEvent $record): ?string => auth()->user()?->can('view', $record)
                        ? TimelineEventResource::getUrl('view', ['record' => $record])
                        : null),
                EditAction::make()
                    ->url(fn (TimelineEvent $record): string => TimelineEventResource::getUrl('edit', ['record' => $record])),
                DeleteAction::make(),
            ])
            ->bulkActions([]);
    }
}
