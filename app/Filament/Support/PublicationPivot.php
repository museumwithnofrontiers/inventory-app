<?php

namespace App\Filament\Support;

use Filament\Forms\Components\Component;
use Filament\Forms\Components\TextInput;
use Filament\Tables\Columns\TextColumn;

/**
 * The pivot metadata of publication_collection and publication_item
 * (display_order, extra), shared by the managers on both sides.
 */
class PublicationPivot
{
    /**
     * @return array<int, Component>
     */
    public static function formFields(): array
    {
        return [
            TextInput::make('display_order')
                ->label('Display order')
                ->numeric()
                ->integer(),
            ExtraJsonField::formComponent(),
        ];
    }

    public static function displayOrderColumn(): TextColumn
    {
        return TextColumn::make('pivot.display_order')
            ->label('Display order')
            ->numeric()
            ->placeholder('—');
    }
}
