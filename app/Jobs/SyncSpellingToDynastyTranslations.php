<?php

namespace App\Jobs;

use App\Models\DynastyTranslation;
use App\Models\GlossarySpelling;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

class SyncSpellingToDynastyTranslations implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 600;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public readonly string $spellingId
    ) {
        $this->onQueue('glossary');
    }

    /**
     * Get the unique ID for the job.
     */
    public function uniqueId(): string
    {
        return 'sync-spelling-dynasty-'.$this->spellingId;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $spelling = GlossarySpelling::find($this->spellingId);

        // If Spelling was deleted, nothing to do
        if (! $spelling) {
            return;
        }

        // Process in chunks to avoid memory issues
        DynastyTranslation::where('language_id', $spelling->language_id)
            ->chunk(100, function ($translations) use ($spelling) {
                foreach ($translations as $translation) {
                    $this->syncSpellingToTranslation($translation, $spelling);
                }
            });
    }

    /**
     * Sync spelling to a single translation.
     */
    private function syncSpellingToTranslation(DynastyTranslation $translation, GlossarySpelling $spelling): void
    {
        $searchText = $this->buildSearchText($translation);

        $matches = $this->textContainsSpelling($searchText, $spelling->spelling);

        DB::transaction(function () use ($translation, $spelling, $matches) {
            if ($matches) {
                // Add the spelling link if not already present
                $translation->spellings()->syncWithoutDetaching([$spelling->id]);
            } else {
                // Remove the spelling link if present
                $translation->spellings()->detach($spelling->id);
            }
        });
    }

    /**
     * Build search text from all relevant DynastyTranslation fields.
     */
    private function buildSearchText(DynastyTranslation $translation): string
    {
        $fields = [
            $translation->name,
            $translation->also_known_as,
            $translation->area,
            $translation->history,
            $translation->date_description_ah,
            $translation->date_description_ad,
        ];

        return implode(' ', array_filter($fields));
    }

    /**
     * Check if text contains the spelling using word boundary matching.
     */
    private function textContainsSpelling(string $text, string $spelling): bool
    {
        // Use word boundary matching with Unicode support and case-insensitive
        $pattern = '/\b'.preg_quote($spelling, '/').'\b/ui';

        return preg_match($pattern, $text) === 1;
    }
}
