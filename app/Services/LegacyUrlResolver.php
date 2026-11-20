<?php

namespace App\Services;

use App\Enums\LegacyLinkConfidence;
use App\Models\Language;
use App\Support\LegacyLinks\LegacyLink;
use App\Support\LegacyLinks\LegacyLinkSet;
use App\Support\LegacyLinks\LegacyReference;
use App\Support\LegacyLinks\Rules\ExploreLegacyUrlRule;
use App\Support\LegacyLinks\Rules\LegacyUrlRule;
use App\Support\LegacyLinks\Rules\Mwnf3CollectionLegacyUrlRule;
use App\Support\LegacyLinks\Rules\Mwnf3ItemLegacyUrlRule;
use App\Support\LegacyLinks\Rules\Mwnf3PartnerLegacyUrlRule;
use App\Support\LegacyLinks\Rules\SharingHistoryLegacyUrlRule;
use App\Support\LegacyLinks\Rules\ThematicGalleryLegacyUrlRule;
use App\Support\LegacyLinks\Rules\TravelsLegacyUrlRule;
use Illuminate\Database\Eloquent\Model;

class LegacyUrlResolver
{
    /** @var array<int, LegacyUrlRule> */
    private array $rules;

    /**
     * @param  array<int, LegacyUrlRule>|null  $rules
     */
    public function __construct(?array $rules = null)
    {
        $this->rules = $rules ?? [
            new Mwnf3ItemLegacyUrlRule,
            new Mwnf3PartnerLegacyUrlRule,
            new Mwnf3CollectionLegacyUrlRule,
            new SharingHistoryLegacyUrlRule,
            new ExploreLegacyUrlRule,
            new TravelsLegacyUrlRule,
            new ThematicGalleryLegacyUrlRule,
        ];
    }

    public function resolveFor(Model $record, string $language = 'en'): LegacyLinkSet
    {
        $bcRaw = $record->getAttribute('backward_compatibility');
        $reference = LegacyReference::parse(is_string($bcRaw) ? $bcRaw : null);

        if ($reference === null) {
            return new LegacyLinkSet([
                LegacyLink::diagnostic('Legacy links unavailable', LegacyLinkConfidence::UNSUPPORTED, $record::class, 'This record has no valid backward compatibility value.'),
            ]);
        }

        $legacyLanguage = $this->legacyLanguageCode($language);

        foreach ($this->rules as $rule) {
            if (! $rule->supports($record, $reference)) {
                continue;
            }

            $links = $rule->resolve($record, $reference, $legacyLanguage);

            if ($links !== []) {
                return new LegacyLinkSet($links);
            }
        }

        return new LegacyLinkSet([
            LegacyLink::diagnostic('Legacy rule missing', LegacyLinkConfidence::UNSUPPORTED, $reference->raw, 'No Legacy Link Resolver rule supports this record type and legacy source pattern yet.'),
        ]);
    }

    private function legacyLanguageCode(string $language): string
    {
        $language = trim($language);

        if ($language === '') {
            return 'en';
        }

        if (strlen($language) === 2) {
            return strtolower($language);
        }

        $configured = config("legacy.links.languages.{$language}");

        if (is_string($configured) && $configured !== '') {
            return strtolower($configured);
        }

        $fromDatabase = Language::query()->whereKey($language)->value('backward_compatibility');

        return is_string($fromDatabase) && $fromDatabase !== '' ? strtolower($fromDatabase) : 'en';
    }
}
