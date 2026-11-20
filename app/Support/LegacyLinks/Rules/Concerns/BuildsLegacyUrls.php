<?php

namespace App\Support\LegacyLinks\Rules\Concerns;

use App\Enums\LegacyLinkConfidence;
use App\Models\Collection;
use App\Models\Country;
use App\Models\Project;
use App\Support\LegacyLinks\LegacyLink;
use App\Support\LegacyLinks\LegacyReference;

trait BuildsLegacyUrls
{
    protected function host(string $key): ?string
    {
        $host = config("legacy.links.public_hosts.{$key}");

        return is_string($host) && $host !== '' ? rtrim($host, '/') : null;
    }

    protected function projectHost(?string $project): ?string
    {
        $project = $this->canonicalProjectCode($project);

        if ($project === null) {
            return null;
        }

        $host = config('legacy.links.public_hosts.projects.'.$project);

        return is_string($host) && $host !== '' ? rtrim($host, '/') : null;
    }

    /**
     * The project code as the configuration spells it. Picture keys carry it
     * in lower case (mwnf3:objects_pictures:bar:…); legacy compares codes
     * without regard to case.
     */
    protected function canonicalProjectCode(?string $project): ?string
    {
        $project = trim((string) $project);

        if ($project === '') {
            return null;
        }

        $hosts = config('legacy.links.public_hosts.projects');

        foreach (is_array($hosts) ? array_keys($hosts) : [] as $code) {
            if (strcasecmp((string) $code, $project) === 0) {
                return (string) $code;
            }
        }

        return $project;
    }

    /**
     * A marker collection the importer adds above a site's records: the
     * site's landing page.
     *
     * @return array<int, LegacyLink>
     */
    protected function rootLandingLinks(string $site, string $label, LegacyReference $reference): array
    {
        $url = config("legacy.links.root_landing_pages.{$site}");

        if (! is_string($url) || $url === '') {
            return [LegacyLink::diagnostic($label, LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, "No landing page is configured for {$site}.")];
        }

        return [LegacyLink::public($label, $url, LegacyLinkConfidence::INFERRED, $reference->raw, 'The marker collection resolves to the landing page of the site it stands for.')];
    }

    /**
     * A configured URL, without its trailing slash.
     */
    protected function configuredUrl(string $key): ?string
    {
        $url = config("legacy.links.{$key}");

        return is_string($url) && $url !== '' ? rtrim($url, '/') : null;
    }

    /**
     * The 1-based position legacy gives a record among its siblings: legacy
     * lists them ORDER BY n, which the importer keeps as display_order.
     */
    protected function siblingPosition(Collection $collection, string $schema, string $table): ?int
    {
        if ($collection->parent_id === null || $collection->display_order === null) {
            return null;
        }

        return Collection::query()
            ->where('parent_id', $collection->parent_id)
            ->where('backward_compatibility', 'like', "{$schema}:{$table}:%")
            ->where('display_order', '<', $collection->display_order)
            ->count() + 1;
    }

    /**
     * The nearest ancestor (the collection itself included) whose key is in
     * the given legacy table.
     */
    protected function ancestorReference(Collection $collection, string $schema, string $table, int $maxDepth = 10): ?LegacyReference
    {
        $current = $collection;

        for ($depth = 0; $depth <= $maxDepth && $current !== null; $depth++) {
            $reference = LegacyReference::parse($current->backward_compatibility);

            if ($reference !== null && $reference->is($schema, $table) && $reference->hasParts(1)) {
                return $reference;
            }

            $current = $current->parent;
        }

        return null;
    }

    protected function backofficeUrl(string $section, string $edit): string
    {
        $host = config('legacy.links.backoffice_host');
        $host = is_string($host) && $host !== '' ? rtrim($host, '/') : 'https://virtual-office.museumwnf.org';

        return "{$host}/?section={$section}&edit={$edit}&";
    }

    protected function firstProjectCode(?Project $project): ?string
    {
        $backwardCompatibility = trim((string) $project?->backward_compatibility);

        if ($backwardCompatibility === '') {
            return null;
        }

        $first = trim(explode(',', $backwardCompatibility)[0]);

        // Project keys are mwnf3:projects:<CODE> (formerly the bare code).
        $reference = LegacyReference::parse($first);

        if ($reference !== null && $reference->is('mwnf3', 'projects') && $reference->hasParts(1)) {
            return trim((string) $reference->part(0));
        }

        return $first;
    }

    protected function legacyCountryCode(?Country $country): ?string
    {
        if ($country === null) {
            return null;
        }

        $backwardRaw = $country->backward_compatibility;
        $keyRaw = $country->getKey();
        $raw = (is_string($backwardRaw) && $backwardRaw !== '') ? $backwardRaw : $keyRaw;
        $code = trim(is_string($raw) ? $raw : '');

        return $code === '' ? null : strtolower($code);
    }

    protected function legacyCountryCodeForCollection(Collection $collection): ?string
    {
        $country = $this->legacyCountryCode($collection->country);

        if ($country !== null) {
            return $country;
        }

        // The country above it: its parent, or further up for a location under a region.
        $countryReference = $collection->parent === null ? null : $this->ancestorReference($collection->parent, 'mwnf3_explore', 'country');

        return $countryReference === null ? null : strtolower((string) $countryReference->part(0));
    }
}
