<?php

namespace App\Support\LegacyLinks\Rules;

use App\Enums\LegacyLinkConfidence;
use App\Models\Collection;
use App\Support\LegacyLinks\LegacyLink;
use App\Support\LegacyLinks\LegacyReference;
use App\Support\LegacyLinks\Rules\Concerns\BuildsLegacyUrls;
use Illuminate\Database\Eloquent\Model;

/**
 * Collections imported from the mwnf3 schema: projects, the Islamic Art and
 * Baroque Art virtual exhibitions and the artistic introduction.
 *
 * Exhibitions and the artistic introduction share one layout: a folder per
 * record whose index.php is the entrance, and a page script that addresses a
 * theme and a page by their 1-based position (legacy lists both ORDER BY n),
 * not by their id.
 */
class Mwnf3CollectionLegacyUrlRule implements LegacyUrlRule
{
    use BuildsLegacyUrls;

    private const SCHEMA = 'mwnf3';

    public function supports(Model $record, LegacyReference $reference): bool
    {
        return $record instanceof Collection && $reference->schema === self::SCHEMA;
    }

    public function resolve(Model $record, LegacyReference $reference, string $legacyLanguage): array
    {
        if (! $record instanceof Collection) {
            return [];
        }

        return match ($reference->table) {
            'projects' => $this->resolveProject($reference),
            'exhibitions' => $reference->part(0) === 'root'
                ? $this->resolveExhibitionList($reference, $legacyLanguage)
                : $this->resolveExhibition($reference, $legacyLanguage),
            'exhibition_themes' => $this->resolveTheme($record, $reference, $legacyLanguage, 'exhibition'),
            'exhibition_pages' => $this->resolvePage($record, $reference, $legacyLanguage, 'exhibition'),
            'artintro', 'artintros' => $this->resolveArtintro($reference, $legacyLanguage),
            'artintro_themes' => $this->resolveTheme($record, $reference, $legacyLanguage, 'artintro'),
            'artintro_pages' => $this->resolvePage($record, $reference, $legacyLanguage, 'artintro'),
            default => [],
        };
    }

    /** @return array<int, LegacyLink> */
    private function resolveProject(LegacyReference $reference): array
    {
        if (! $reference->hasParts(1)) {
            return [];
        }

        $project = (string) $reference->part(0);
        $landing = $this->configuredUrl("project_landing_pages.{$project}");

        return [
            $landing === null
                ? LegacyLink::diagnostic('Legacy project page', LegacyLinkConfidence::UNSUPPORTED, $reference->raw, "Project {$project} had no site of its own; its records appear on other projects' sites.")
                : LegacyLink::public('Legacy project home page', $landing, LegacyLinkConfidence::EXACT, $reference->raw),
            LegacyLink::backoffice('Legacy project back-office record', $this->backofficeUrl('manage/projects', "1;{$project}"), LegacyLinkConfidence::EXACT, $reference->raw),
        ];
    }

    /** @return array<int, LegacyLink> */
    private function resolveExhibitionList(LegacyReference $reference, string $legacyLanguage): array
    {
        // mwnf3:exhibitions:root is Discover Islamic Art's; others name their project.
        $project = $reference->part(1) ?? 'ISL';
        $list = $this->configuredUrl("mwnf3_exhibition_lists.{$project}");

        if ($list === null) {
            return [LegacyLink::diagnostic('Legacy exhibition list', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, "No exhibition list is configured for project {$project}.")];
        }

        return [
            LegacyLink::public('Legacy virtual exhibitions page', "{$list}/index.php?lng={$legacyLanguage}", LegacyLinkConfidence::EXACT, $reference->raw),
        ];
    }

    /** @return array<int, LegacyLink> */
    private function resolveExhibition(LegacyReference $reference, string $legacyLanguage): array
    {
        if (! $reference->hasParts(1)) {
            return [];
        }

        $exhibition = (string) $reference->part(0);
        $folder = $this->configuredUrl("mwnf3_exhibitions.{$exhibition}");
        $links = [];

        $links[] = $folder === null
            ? LegacyLink::diagnostic('Legacy exhibition page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, "No folder is configured for exhibition {$exhibition}.")
            : LegacyLink::public('Legacy exhibition entrance', "{$folder}/index.php?lng={$legacyLanguage}", LegacyLinkConfidence::EXACT, $reference->raw);

        $links[] = LegacyLink::backoffice('Legacy exhibition back-office record', $this->backofficeUrl('database/exhibitions', "1;{$exhibition}"), LegacyLinkConfidence::EXACT, $reference->raw);

        return $links;
    }

    /** @return array<int, LegacyLink> */
    private function resolveArtintro(LegacyReference $reference, string $legacyLanguage): array
    {
        // mwnf3:artintro:root is the marker collection above the only artintro.
        $artintro = $reference->table === 'artintro' ? '1' : (string) $reference->part(0);
        $folder = $this->configuredUrl("mwnf3_artintros.{$artintro}");
        $links = [];

        $links[] = $folder === null
            ? LegacyLink::diagnostic('Legacy artistic introduction page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, "No folder is configured for artistic introduction {$artintro}.")
            : LegacyLink::public('Legacy artistic introduction home page', "{$folder}/index.php?lng={$legacyLanguage}", $reference->table === 'artintro' ? LegacyLinkConfidence::INFERRED : LegacyLinkConfidence::EXACT, $reference->raw, $reference->table === 'artintro' ? 'The marker collection resolves to the artistic introduction it holds.' : null);

        if ($reference->table === 'artintros') {
            $links[] = LegacyLink::backoffice('Legacy artistic introduction back-office record', $this->backofficeUrl('database/artintros', "1;{$artintro}"), LegacyLinkConfidence::EXACT, $reference->raw);
        }

        return $links;
    }

    /**
     * An exhibition or artintro theme: the page script shows its first page.
     *
     * @param  'exhibition'|'artintro'  $kind
     * @return array<int, LegacyLink>
     */
    private function resolveTheme(Collection $theme, LegacyReference $reference, string $legacyLanguage, string $kind): array
    {
        if (! $reference->hasParts(1)) {
            return [];
        }

        $parent = $this->parentReference($theme, $kind === 'exhibition' ? 'exhibitions' : 'artintros');
        $position = $this->siblingPosition($theme, self::SCHEMA, "{$kind}_themes");

        if ($parent === null || $position === null) {
            return [LegacyLink::diagnostic("Legacy {$this->noun($kind)} theme page", LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, "Theme URLs need the parent {$this->noun($kind)} and the theme's order.")];
        }

        $folder = $this->folder($kind, (string) $parent->part(0));
        $links = [];

        $links[] = $folder === null
            ? LegacyLink::diagnostic("Legacy {$this->noun($kind)} theme page", LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, "No folder is configured for {$this->noun($kind)} {$parent->part(0)}.")
            : LegacyLink::public("Legacy {$this->noun($kind)} theme page", "{$folder}/{$this->pageScript($kind)}?theme={$position}&page=1&lng={$legacyLanguage}", LegacyLinkConfidence::EXACT, $reference->raw, 'Legacy addresses a theme by its position; the theme opens on its first page.');

        $links[] = LegacyLink::backoffice("Legacy {$this->noun($kind)} theme back-office record", $this->backofficeUrl($this->backofficeSection($kind), "2;{$parent->part(0)};{$reference->part(0)}"), LegacyLinkConfidence::EXACT, $reference->raw);

        return $links;
    }

    /**
     * @param  'exhibition'|'artintro'  $kind
     * @return array<int, LegacyLink>
     */
    private function resolvePage(Collection $page, LegacyReference $reference, string $legacyLanguage, string $kind): array
    {
        if (! $reference->hasParts(1)) {
            return [];
        }

        $theme = $page->parent;
        $themeReference = LegacyReference::parse($theme?->backward_compatibility);
        $parent = $theme === null ? null : $this->parentReference($theme, $kind === 'exhibition' ? 'exhibitions' : 'artintros');
        $themePosition = $theme === null ? null : $this->siblingPosition($theme, self::SCHEMA, "{$kind}_themes");
        $pagePosition = $this->siblingPosition($page, self::SCHEMA, "{$kind}_pages");

        if (! $themeReference?->is(self::SCHEMA, "{$kind}_themes") || $parent === null || $themePosition === null || $pagePosition === null) {
            return [LegacyLink::diagnostic("Legacy {$this->noun($kind)} page", LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, "Page URLs need the parent theme, the parent {$this->noun($kind)} and their order.")];
        }

        $folder = $this->folder($kind, (string) $parent->part(0));
        $links = [];

        $links[] = $folder === null
            ? LegacyLink::diagnostic("Legacy {$this->noun($kind)} page", LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, "No folder is configured for {$this->noun($kind)} {$parent->part(0)}.")
            : LegacyLink::public("Legacy {$this->noun($kind)} page", "{$folder}/{$this->pageScript($kind)}?theme={$themePosition}&page={$pagePosition}&lng={$legacyLanguage}", LegacyLinkConfidence::EXACT, $reference->raw, 'Legacy addresses a page by the position of its theme and of the page.');

        $links[] = LegacyLink::backoffice("Legacy {$this->noun($kind)} page back-office record", $this->backofficeUrl($this->backofficeSection($kind), "3;{$parent->part(0)};{$themeReference->part(0)};{$reference->part(0)}"), LegacyLinkConfidence::EXACT, $reference->raw);

        return $links;
    }

    private function parentReference(Collection $theme, string $table): ?LegacyReference
    {
        $reference = LegacyReference::parse($theme->parent?->backward_compatibility);

        return $reference !== null && $reference->is(self::SCHEMA, $table) && $reference->hasParts(1) && $reference->part(0) !== 'root'
            ? $reference
            : null;
    }

    /** @param  'exhibition'|'artintro'  $kind */
    private function folder(string $kind, string $id): ?string
    {
        return $this->configuredUrl(($kind === 'exhibition' ? 'mwnf3_exhibitions' : 'mwnf3_artintros').".{$id}");
    }

    /** @param  'exhibition'|'artintro'  $kind */
    private function pageScript(string $kind): string
    {
        return $kind === 'exhibition' ? 'exhibition.php' : 'page.php';
    }

    /** @param  'exhibition'|'artintro'  $kind */
    private function backofficeSection(string $kind): string
    {
        return $kind === 'exhibition' ? 'database/exhibitions' : 'database/artintros';
    }

    /** @param  'exhibition'|'artintro'  $kind */
    private function noun(string $kind): string
    {
        return $kind === 'exhibition' ? 'exhibition' : 'artistic introduction';
    }
}
