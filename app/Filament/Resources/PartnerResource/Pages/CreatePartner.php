<?php

namespace App\Filament\Resources\PartnerResource\Pages;

use App\Filament\Concerns\PrefillsCreateFormFromQuery;
use App\Filament\Resources\PartnerResource;
use App\Models\Project;
use Filament\Resources\Pages\CreateRecord;

class CreatePartner extends CreateRecord
{
    use PrefillsCreateFormFromQuery;

    protected static string $resource = PartnerResource::class;

    /**
     * @return array<string, class-string>
     */
    protected function queryPrefillFields(): array
    {
        return [
            'project_id' => Project::class,
        ];
    }
}
