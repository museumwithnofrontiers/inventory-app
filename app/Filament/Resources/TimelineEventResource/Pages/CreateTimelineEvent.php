<?php

namespace App\Filament\Resources\TimelineEventResource\Pages;

use App\Filament\Concerns\PrefillsCreateFormFromQuery;
use App\Filament\Resources\TimelineEventResource;
use App\Models\Timeline;
use Filament\Resources\Pages\CreateRecord;

/**
 * M7 story A5.4 (#2090): accepts `timeline_id` from EventsRelationManager's
 * header `Create` action, via {@see PrefillsCreateFormFromQuery}.
 */
class CreateTimelineEvent extends CreateRecord
{
    use PrefillsCreateFormFromQuery;

    protected static string $resource = TimelineEventResource::class;

    /**
     * @return array<string, class-string>
     */
    protected function queryPrefillFields(): array
    {
        return [
            'timeline_id' => Timeline::class,
        ];
    }
}
