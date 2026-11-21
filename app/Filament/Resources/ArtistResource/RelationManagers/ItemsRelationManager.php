<?php

namespace App\Filament\Resources\ArtistResource\RelationManagers;

use App\Filament\Resources\RelationManagers\BaseLinkedItemsRelationManager;

/**
 * The items linked to an artist: the other side of the item's Artists manager.
 */
class ItemsRelationManager extends BaseLinkedItemsRelationManager
{
    protected function inverseRelationshipName(): string
    {
        return 'artists';
    }
}
