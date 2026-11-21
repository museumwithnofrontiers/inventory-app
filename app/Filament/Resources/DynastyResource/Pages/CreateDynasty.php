<?php

namespace App\Filament\Resources\DynastyResource\Pages;

use App\Filament\Resources\DynastyResource;
use Filament\Resources\Pages\CreateRecord;

/**
 * Creates the dynasty's dates and legacy code; Filament then opens its View
 * page, where its translations (names, area, history) are added.
 */
class CreateDynasty extends CreateRecord
{
    protected static string $resource = DynastyResource::class;
}
