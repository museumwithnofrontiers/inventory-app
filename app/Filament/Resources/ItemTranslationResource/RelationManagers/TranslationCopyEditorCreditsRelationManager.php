<?php

namespace App\Filament\Resources\ItemTranslationResource\RelationManagers;

class TranslationCopyEditorCreditsRelationManager extends BaseCreditsRelationManager
{
    protected static string $relationship = 'translationCopyEditorCredits';

    protected static string $inverseCreditRelationship = 'itemTranslationsCreditedAsTranslationCopyEditor';

    protected static ?string $title = 'Translation copy editors';
}
