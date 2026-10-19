<?php

namespace App\Filament\Resources\ItemTranslationResource\RelationManagers;

class TranslatorCreditsRelationManager extends BaseCreditsRelationManager
{
    protected static string $relationship = 'translatorCredits';

    protected static ?string $title = 'Translators';
}
