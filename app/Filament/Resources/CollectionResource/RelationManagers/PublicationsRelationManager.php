<?php

namespace App\Filament\Resources\CollectionResource\RelationManagers;

use App\Filament\Resources\RelationManagers\BasePublicationsRelationManager;

/**
 * The publications that accompany this collection.
 */
class PublicationsRelationManager extends BasePublicationsRelationManager
{
    protected static function inverseRelationshipName(): string
    {
        return 'collections';
    }
}
