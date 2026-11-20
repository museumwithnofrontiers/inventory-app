<?php

namespace App\Support\LegacyLinks\Rules;

use App\Enums\LegacyLinkConfidence;
use App\Models\Partner;
use App\Support\LegacyLinks\LegacyLink;
use App\Support\LegacyLinks\LegacyReference;
use App\Support\LegacyLinks\Rules\Concerns\BuildsLegacyUrls;
use Illuminate\Database\Eloquent\Model;

class Mwnf3PartnerLegacyUrlRule implements LegacyUrlRule
{
    use BuildsLegacyUrls;

    public function supports(Model $record, LegacyReference $reference): bool
    {
        return $record instanceof Partner && $reference->schema === 'mwnf3';
    }

    public function resolve(Model $record, LegacyReference $reference, string $legacyLanguage): array
    {
        if (! $record instanceof Partner) {
            return [];
        }

        if ($reference->table === 'schools' && $reference->hasParts(2)) {
            [$school, $country] = array_slice($reference->parts, 0, 2);

            return [
                LegacyLink::diagnostic('Legacy school page', LegacyLinkConfidence::UNSUPPORTED, $reference->raw, 'The legacy sites have no public page for schools.'),
                LegacyLink::backoffice('Legacy school back-office record', $this->backofficeUrl('database/school', "1;{$school};{$country}"), LegacyLinkConfidence::EXACT, $reference->raw),
            ];
        }

        if (! in_array($reference->table, ['museums', 'institutions'], true) || ! $reference->hasParts(2)) {
            return [];
        }

        $project = $this->projectCode($record);

        if ($project === null) {
            return [LegacyLink::diagnostic('Legacy partner page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, 'The partner legacy URL needs a project code from Inventory context or legacy lookup.')];
        }

        $host = $this->projectHost($project);

        if ($host === null) {
            return [LegacyLink::diagnostic('Legacy partner page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, "No public host is configured for project {$project}.")];
        }

        $type = $reference->table === 'museums' ? 'museum' : 'institution';
        $section = $reference->table === 'museums' ? 'database/museum' : 'database/institution';
        [$partnerCode, $country] = array_slice($reference->parts, 0, 2);

        return [
            LegacyLink::public(
                label: 'Legacy partner page',
                url: "{$host}/pm_partner.php?id={$partnerCode};{$country}&type={$type}&theme={$project}",
                confidence: LegacyLinkConfidence::INFERRED,
                source: $reference->raw,
                note: 'Project context comes from the Inventory partner or its holdings.',
            ),
            LegacyLink::backoffice(
                label: 'Legacy partner back-office record',
                url: $this->backofficeUrl($section, "1;{$partnerCode};{$country}"),
                confidence: LegacyLinkConfidence::EXACT,
                source: $reference->raw,
            ),
        ];
    }

    private function projectCode(Partner $partner): ?string
    {
        $project = $this->firstProjectCode($partner->project);

        if ($project !== null) {
            return $project;
        }

        $item = $partner->items()->with('project:id,backward_compatibility')->whereNotNull('project_id')->first();

        return $this->firstProjectCode($item?->project);
    }
}
