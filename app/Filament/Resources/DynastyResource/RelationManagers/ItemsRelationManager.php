<?php

namespace App\Filament\Resources\DynastyResource\RelationManagers;

use App\Filament\Resources\RelationManagers\BaseLinkedItemsRelationManager;

/**
 * The items linked to a dynasty: the other side of the item's Dynasties
 * manager.
 */
class ItemsRelationManager extends BaseLinkedItemsRelationManager
{
    protected function inverseRelationshipName(): string
    {
        return 'dynasties';
    }
}
