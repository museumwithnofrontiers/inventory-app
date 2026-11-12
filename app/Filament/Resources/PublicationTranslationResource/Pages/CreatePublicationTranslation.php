<?php

namespace App\Filament\Resources\PublicationTranslationResource\Pages;

use App\Filament\Concerns\PrefillsCreateFormFromQuery;
use App\Filament\Resources\PublicationTranslationResource;
use App\Models\Publication;
use Filament\Resources\Pages\CreateRecord;

class CreatePublicationTranslation extends CreateRecord
{
    use PrefillsCreateFormFromQuery;

    protected static string $resource = PublicationTranslationResource::class;

    /**
     * @return array<string, class-string>
     */
    protected function queryPrefillFields(): array
    {
        return [
            'publication_id' => Publication::class,
        ];
    }
}
