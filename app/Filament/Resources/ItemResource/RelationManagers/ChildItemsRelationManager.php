<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Filament\Concerns\HasManyChildActions;
use App\Filament\Support\RecordSelect;

/**
 * M7 story A1.2 (epic #1872): the has-many convention on an item's own
 * children. Header `Create` (Item's own Create page, `parent_id` and — when
 * the parent has one — `partner_id` pre-filled) and `Attach existing`
 * (AssociateAction, cycle-guarded via
 * {@see RecordSelect::excludingAncestorsOf()} so an
 * ancestor of this item can never become one of its children). Row `View` ·
 * `Edit` · `Detach` (clears `parent_id` only) · `Delete`. Bulk `Detach`. All
 * shared wiring lives on {@see BaseChildItemsRelationManager} (and
 * {@see HasManyChildActions}), which A1.3's
 * PictureItemsRelationManager also extends.
 */
class ChildItemsRelationManager extends BaseChildItemsRelationManager
{
    protected static ?string $title = 'Child items';
}
