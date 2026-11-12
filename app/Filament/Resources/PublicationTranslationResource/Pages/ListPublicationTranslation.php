<?php

namespace App\Filament\Resources\PublicationTranslationResource\Pages;

use App\Filament\Resources\PublicationTranslationResource;
use App\Models\Context;
use App\Models\Language;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListPublicationTranslation extends ListRecords
{
    protected static string $resource = PublicationTranslationResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()
                ->fillForm(fn (): array => [
                    'language_id' => Language::default()->first()?->id,
                    'context_id' => Context::default()->first()?->id,
                ]),
        ];
    }
}
