<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Filament\Resources\RelationManagers\BasePublicationsRelationManager;

/**
 * The publications that cite this item outside the collections they
 * accompany.
 */
class PublicationsRelationManager extends BasePublicationsRelationManager
{
    protected static function inverseRelationshipName(): string
    {
        return 'items';
    }
}
