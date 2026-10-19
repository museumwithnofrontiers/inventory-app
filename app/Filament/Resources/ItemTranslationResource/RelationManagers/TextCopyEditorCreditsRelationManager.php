<?php

namespace App\Filament\Resources\ItemTranslationResource\RelationManagers;

class TextCopyEditorCreditsRelationManager extends BaseCreditsRelationManager
{
    protected static string $relationship = 'textCopyEditorCredits';

    protected static ?string $title = 'Text copy editors';
}
