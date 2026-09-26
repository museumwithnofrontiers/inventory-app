<?php

namespace App\Filament\Resources\PartnerTranslationResource\Pages;

use App\Filament\Concerns\PrefillsCreateFormFromQuery;
use App\Filament\Resources\PartnerTranslationResource;
use App\Models\Partner;
use Filament\Resources\Pages\CreateRecord;

class CreatePartnerTranslation extends CreateRecord
{
    use PrefillsCreateFormFromQuery;

    protected static string $resource = PartnerTranslationResource::class;

    /**
     * @return array<string, class-string>
     */
    protected function queryPrefillFields(): array
    {
        return [
            'partner_id' => Partner::class,
        ];
    }
}
