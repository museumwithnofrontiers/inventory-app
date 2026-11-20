<?php

namespace App\Support\LegacyLinks\Rules;

use App\Enums\LegacyLinkConfidence;
use App\Models\Collection;
use App\Support\LegacyLinks\LegacyLink;
use App\Support\LegacyLinks\LegacyReference;
use App\Support\LegacyLinks\Rules\Concerns\BuildsLegacyUrls;
use App\Support\LegacyLinks\Rules\Concerns\ResolvesThematicGalleryUrls;
use Illuminate\Database\Eloquent\Model;

class ThematicGalleryLegacyUrlRule implements LegacyUrlRule
{
    use BuildsLegacyUrls, ResolvesThematicGalleryUrls;

    public function supports(Model $record, LegacyReference $reference): bool
    {
        return $record instanceof Collection && $reference->schema === 'mwnf3_thematic_gallery';
    }

    public function resolve(Model $record, LegacyReference $reference, string $legacyLanguage): array
    {
        if (! $record instanceof Collection) {
            return [];
        }

        return match ($reference->table) {
            'thg_gallery' => $this->resolveGallery($record, $reference, $legacyLanguage),
            'theme' => $this->resolveTheme($reference, $legacyLanguage),
            'galleries_root' => $this->rootLandingLinks('thg_galleries', 'MWNF Galleries home page', $reference),
            'exhibitions_root' => $this->rootLandingLinks('thg_exhibitions', 'MWNF Exhibitions home page', $reference),
            default => [],
        };
    }

    /** @return array<int, LegacyLink> */
    private function resolveGallery(Collection $record, LegacyReference $reference, string $legacyLanguage): array
    {
        if (! $reference->hasParts(1)) {
            return [];
        }

        $landing = $this->thematicGalleryLandingUrl((string) $reference->part(0), $legacyLanguage, $record);

        if ($landing === null) {
            return [LegacyLink::diagnostic('Thematic gallery landing page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, 'The gallery id needs a configured public slug or host.')];
        }

        return [
            LegacyLink::public('Thematic gallery landing page', $landing, LegacyLinkConfidence::EXACT, $reference->raw),
            LegacyLink::backoffice('Thematic gallery back-office record', $this->backofficeUrl('thg/thg_galleries', "1;{$reference->part(0)}"), LegacyLinkConfidence::EXACT, $reference->raw),
        ];
    }

    /** @return array<int, LegacyLink> */
    private function resolveTheme(LegacyReference $reference, string $legacyLanguage): array
    {
        if (! $reference->hasParts(2)) {
            return [];
        }

        $landing = $this->thematicGalleryLandingUrl((string) $reference->part(0), $legacyLanguage);

        if ($landing === null) {
            return [LegacyLink::diagnostic('Thematic gallery theme page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, 'Theme URLs need the gallery public slug or host.')];
        }

        return [
            LegacyLink::public('Thematic gallery theme page', rtrim($landing, '/')."/theme/{$reference->part(1)}", LegacyLinkConfidence::EXACT, $reference->raw),
            LegacyLink::backoffice('Thematic gallery theme back-office record', $this->backofficeUrl('thg/thg_galleries', "1;{$reference->part(0)};{$reference->part(1)}"), LegacyLinkConfidence::EXACT, $reference->raw),
        ];
    }
}
