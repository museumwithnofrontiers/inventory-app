<?php

namespace App\Filament\Support;

use App\Models\TimelineEventItem;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\TextInput;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Database\Eloquent\Model;

/**
 * Shared Filament helpers for the timeline_event_item pivot (`display_order`,
 * `extra`, importer-owned `backward_compatibility`) — M7 story A2.3 (#1902).
 * Used identically by both sides of the pivot: ItemResource's
 * TimelineEventsRelationManager and TimelineEventResource's own
 * ItemsRelationManager.
 */
class TimelineEventItemPivot
{
    /**
     * The pivot's own editable fields — display_order and extra — used by
     * both managers' Attach and Edit-pivot forms. backward_compatibility is
     * deliberately never included here: it is importer-owned.
     *
     * @return array<int, Component>
     */
    public static function pivotFormFields(): array
    {
        return [
            TextInput::make('display_order')
                ->label('Display order')
                ->numeric()
                ->integer()
                ->default(0),
            ExtraJsonField::formComponent(),
        ];
    }

    public static function displayOrderColumn(): TextColumn
    {
        return TextColumn::make('pivot.display_order')
            ->label('Display order')
            ->numeric()
            ->sortable()
            ->placeholder('—');
    }

    /**
     * The pivot's own backward_compatibility column, named without a `pivot.`
     * prefix so it satisfies RelationManagerConventionTest's exact-name check
     * for a shared 'backward_compatibility' column, while still sourcing its
     * value from the pivot (not the related record's own, unrelated, column
     * of the same name) via an explicit getStateUsing().
     */
    public static function backwardCompatibilityColumn(): TextColumn
    {
        return TextColumn::make('backward_compatibility')
            ->label('Legacy code')
            ->getStateUsing(function (Model $record): ?string {
                $pivot = $record->getAttribute('pivot');

                return $pivot instanceof TimelineEventItem ? $pivot->backward_compatibility : null;
            })
            ->toggleable(isToggledHiddenByDefault: true);
    }
}
