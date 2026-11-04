<?php

namespace App\Console\Commands;

use App\Models\CollectionTranslation;
use App\Models\DynastyTranslation;
use App\Models\GlossarySpelling;
use App\Models\ItemTranslation;
use App\Models\TimelineEventTranslation;
use Illuminate\Console\Command;

class GlossaryBulkResync extends Command
{
    /**
     * `glossary:resync` dispatches one job per glossary spelling, and each job
     * re-scans every translation of that language — O(spellings x translations).
     * This command inverts the loop: one combined regex per language, one pass
     * over each translation. Produces the same end state (item/collection/
     * timeline-event/dynasty <-> spelling links) as glossary:resync, in a fraction of
     * the time, because the per-language pattern is checked once per
     * translation instead of once per spelling per translation.
     *
     * No --remove-existing flag: every translation's link set is fully
     * recomputed via sync() on each run, so stale links are always dropped,
     * not just newly-matching ones added. glossary:resync needs the flag as an
     * opt-in wipe because its per-spelling jobs only reconcile spellings that
     * still exist; this command doesn't have an equivalent gap to opt out of —
     * spelling deletion also detaches its links transactionally (see
     * GlossarySpelling::delete()) and cascades at the DB level, so there is
     * never a stale link left for a "remove existing" step to find.
     *
     * Runs synchronously (no queue) — it's already a single pass per
     * translation, there's nothing left to usefully parallelize via jobs.
     *
     * @var string
     */
    protected $signature = 'glossary:bulk-resync {--chunk=200 : Translations per chunk} {--dry-run : Report counts without writing any links}';

    /**
     * @var string
     */
    protected $description = 'Bulk-resynchronise glossary spellings to item, collection, timeline event, and dynasty translations using one combined pattern per language per translation, instead of one queued job per spelling.';

    public function handle(): int
    {
        $chunkSize = max(1, (int) $this->option('chunk'));
        $dryRun = (bool) $this->option('dry-run');

        $languages = GlossarySpelling::query()->distinct()->pluck('language_id');

        if ($languages->isEmpty()) {
            $this->info('No glossary spellings found. Nothing to do.');

            return 0;
        }

        $this->info('Bulk-resyncing glossary across '.$languages->count().' language(s)'.($dryRun ? ' (dry run)' : '').'...');

        $totals = ['item' => 0, 'collection' => 0, 'timeline_event' => 0, 'dynasty' => 0];

        foreach ($languages as $languageId) {
            [$pattern, $spellingIdsByText] = $this->buildPatternForLanguage($languageId);

            if ($pattern === null) {
                continue;
            }

            $totals['item'] += $this->syncItemTranslations(
                $languageId, $pattern, $spellingIdsByText, $chunkSize, $dryRun
            );

            $totals['collection'] += $this->syncCollectionTranslations(
                $languageId, $pattern, $spellingIdsByText, $chunkSize, $dryRun
            );

            $totals['timeline_event'] += $this->syncTimelineEventTranslations(
                $languageId, $pattern, $spellingIdsByText, $chunkSize, $dryRun
            );

            $totals['dynasty'] += $this->syncDynastyTranslations(
                $languageId, $pattern, $spellingIdsByText, $chunkSize, $dryRun
            );
        }

        $this->newLine();
        $this->info(sprintf(
            'Done. Processed %d item, %d collection, %d timeline event, %d dynasty translations.',
            $totals['item'],
            $totals['collection'],
            $totals['timeline_event'],
            $totals['dynasty']
        ));

        return 0;
    }

    /**
     * Builds one case-insensitive, Unicode-aware alternation pattern covering every
     * spelling in this language, longest spelling first so multi-word phrases win
     * over any shorter phrase/word they contain. Every spelling is individually
     * escaped via preg_quote before joining — real data has spellings containing
     * parentheses (e.g. "Ghiordes (Gördes) knot"), so building the alternation via
     * plain string concatenation would silently corrupt the pattern.
     *
     * The lookup map is keyed by lowercased spelling text -> list of spelling ids,
     * not a single id: the same spelling text (case-insensitively) is sometimes
     * shared by more than one distinct glossary entry in the same language in real
     * data (e.g. several Arabic spellings each attached to two different glossary
     * ids), so a match must be able to attach all of them, not just one.
     *
     * @return array{0: ?string, 1: array<string, list<string>>}
     */
    private function buildPatternForLanguage(string $languageId): array
    {
        $spellings = GlossarySpelling::query()
            ->where('language_id', $languageId)
            ->get(['id', 'spelling']);

        if ($spellings->isEmpty()) {
            return [null, []];
        }

        $sorted = $spellings->sortByDesc(fn (GlossarySpelling $s) => mb_strlen($s->spelling))->values();

        $map = [];
        $escaped = [];
        foreach ($sorted as $s) {
            $escaped[] = preg_quote($s->spelling, '/');
            $key = mb_strtolower($s->spelling);
            $map[$key][] = $s->id;
        }

        $pattern = '/\b('.implode('|', $escaped).')\b/ui';

        return [$pattern, $map];
    }

    /**
     * Resolves which spelling ids a piece of text matches — pure string/array
     * logic, deliberately free of any Eloquent model type so it's shared without
     * fighting Builder's generic (co)variance across three unrelated model types.
     *
     * @param  array<string, list<string>>  $spellingIdsByText
     * @return list<string>
     */
    private function matchSpellingIds(string $text, string $pattern, array $spellingIdsByText): array
    {
        if ($text === '' || ! preg_match_all($pattern, $text, $matches)) {
            return [];
        }

        $matchedIds = [];
        foreach (array_unique(array_map(mb_strtolower(...), $matches[1])) as $matchedText) {
            foreach ($spellingIdsByText[$matchedText] ?? [] as $id) {
                $matchedIds[] = $id;
            }
        }

        return array_values(array_unique($matchedIds));
    }

    /**
     * @param  array<string, list<string>>  $spellingIdsByText
     */
    private function syncItemTranslations(
        string $languageId,
        string $pattern,
        array $spellingIdsByText,
        int $chunkSize,
        bool $dryRun
    ): int {
        $count = 0;

        ItemTranslation::query()->where('language_id', $languageId)
            ->chunk($chunkSize, function ($translations) use (&$count, $pattern, $spellingIdsByText, $dryRun) {
                foreach ($translations as $translation) {
                    $text = implode(' ', array_filter([
                        $translation->name, $translation->alternate_name, $translation->description,
                        $translation->type, $translation->holder, $translation->owner,
                        $translation->initial_owner, $translation->dates, $translation->location,
                        $translation->dimensions, $translation->place_of_production,
                        $translation->method_for_datation, $translation->method_for_provenance,
                        $translation->obtention, $translation->bibliography,
                    ]));

                    if (! $dryRun) {
                        $translation->spellings()->sync($this->matchSpellingIds($text, $pattern, $spellingIdsByText));
                    }
                    $count++;
                }
            });

        $this->line("  [item] {$count} translations processed for language {$languageId}");

        return $count;
    }

    /**
     * @param  array<string, list<string>>  $spellingIdsByText
     */
    private function syncCollectionTranslations(
        string $languageId,
        string $pattern,
        array $spellingIdsByText,
        int $chunkSize,
        bool $dryRun
    ): int {
        $count = 0;

        CollectionTranslation::query()->where('language_id', $languageId)
            ->chunk($chunkSize, function ($translations) use (&$count, $pattern, $spellingIdsByText, $dryRun) {
                foreach ($translations as $translation) {
                    $text = implode(' ', array_filter([
                        $translation->title, $translation->description, $translation->quote,
                    ]));

                    if (! $dryRun) {
                        $translation->spellings()->sync($this->matchSpellingIds($text, $pattern, $spellingIdsByText));
                    }
                    $count++;
                }
            });

        $this->line("  [collection] {$count} translations processed for language {$languageId}");

        return $count;
    }

    /**
     * @param  array<string, list<string>>  $spellingIdsByText
     */
    private function syncTimelineEventTranslations(
        string $languageId,
        string $pattern,
        array $spellingIdsByText,
        int $chunkSize,
        bool $dryRun
    ): int {
        $count = 0;

        TimelineEventTranslation::query()->where('language_id', $languageId)
            ->chunk($chunkSize, function ($translations) use (&$count, $pattern, $spellingIdsByText, $dryRun) {
                foreach ($translations as $translation) {
                    $text = implode(' ', array_filter([
                        $translation->name, $translation->description,
                        $translation->date_from_description, $translation->date_to_description,
                        $translation->date_from_ah_description,
                    ]));

                    if (! $dryRun) {
                        $translation->spellings()->sync($this->matchSpellingIds($text, $pattern, $spellingIdsByText));
                    }
                    $count++;
                }
            });

        $this->line("  [timeline event] {$count} translations processed for language {$languageId}");

        return $count;
    }

    /**
     * @param  array<string, list<string>>  $spellingIdsByText
     */
    private function syncDynastyTranslations(
        string $languageId,
        string $pattern,
        array $spellingIdsByText,
        int $chunkSize,
        bool $dryRun
    ): int {
        $count = 0;

        DynastyTranslation::query()->where('language_id', $languageId)
            ->chunk($chunkSize, function ($translations) use (&$count, $pattern, $spellingIdsByText, $dryRun) {
                foreach ($translations as $translation) {
                    $text = implode(' ', array_filter([
                        $translation->name, $translation->also_known_as, $translation->area,
                        $translation->history, $translation->date_description_ah,
                        $translation->date_description_ad,
                    ]));

                    if (! $dryRun) {
                        $translation->spellings()->sync($this->matchSpellingIds($text, $pattern, $spellingIdsByText));
                    }
                    $count++;
                }
            });

        $this->line("  [dynasty] {$count} translations processed for language {$languageId}");

        return $count;
    }
}
