<?php

namespace App\Filament\Resources\PublicationTranslationResource\RelationManagers;

use App\Filament\Resources\PublicationTranslationResource;
use App\Filament\Resources\RelationManagers\BaseSiblingTranslationsRelationManager;

class SiblingTranslationsRelationManager extends BaseSiblingTranslationsRelationManager
{
    protected static function translationResource(): string
    {
        return PublicationTranslationResource::class;
    }

    protected static function translationTitleAttribute(): string
    {
        return 'title';
    }
}
