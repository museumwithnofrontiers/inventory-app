<?php

namespace App\Filament\Resources\ItemTranslationResource\RelationManagers;

class AuthorCreditsRelationManager extends BaseCreditsRelationManager
{
    protected static string $relationship = 'authorCredits';

    protected static ?string $title = 'Authors';
}
