<?php

namespace App\Filament\Concerns;

use App\Filament\Support\MarkdownState;
use Filament\Tables\Columns\TextColumn;

trait HasInternalNameColumn
{
    protected static function internalNameColumn(): TextColumn
    {
        return TextColumn::make('internal_name')
            ->formatStateUsing(MarkdownState::inline())
            ->searchable()
            ->sortable();
    }
}
