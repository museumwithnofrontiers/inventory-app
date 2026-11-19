<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Enums\ItemType;
use App\Filament\Resources\RelationManagers\BaseVisitInformationRelationManager;
use App\Models\Item;
use Illuminate\Database\Eloquent\Model;

/** The visit information of a monument (M16 D1, #2645). */
class VisitInformationRelationManager extends BaseVisitInformationRelationManager
{
    /** Only a monument has visit information. */
    public static function canViewForRecord(Model $ownerRecord, string $pageClass): bool
    {
        return $ownerRecord instanceof Item
            && $ownerRecord->type === ItemType::MONUMENT
            && parent::canViewForRecord($ownerRecord, $pageClass);
    }
}
