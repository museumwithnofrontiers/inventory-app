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

class SyncDynastyTranslationSpellings implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 300;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public readonly string $dynastyTranslationId
    ) {
        $this->onQueue('glossary');
    }

    /**
     * Get the unique ID for the job.
     */
    public function uniqueId(): string
    {
        return 'sync-dynasty-translation-'.$this->dynastyTranslationId;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $dynastyTranslation = DynastyTranslation::find($this->dynastyTranslationId);

        // If DynastyTranslation was deleted, nothing to do
        if (! $dynastyTranslation) {
            return;
        }

        // Get all spellings for this language
        $spellings = GlossarySpelling::where('language_id', $dynastyTranslation->language_id)->get();

        // Find matching spellings in the translation text
        $matchingSpellingIds = [];
        $searchText = $this->buildSearchText($dynastyTranslation);

        foreach ($spellings as $spelling) {
            if ($this->textContainsSpelling($searchText, $spelling->spelling)) {
                $matchingSpellingIds[] = $spelling->id;
            }
        }

        // Sync the relationships (atomic operation)
        DB::transaction(function () use ($dynastyTranslation, $matchingSpellingIds) {
            $dynastyTranslation->spellings()->sync($matchingSpellingIds);
        });
    }

    /**
     * Build search text from all relevant DynastyTranslation fields.
     */
    private function buildSearchText(DynastyTranslation $dynastyTranslation): string
    {
        $fields = [
            $dynastyTranslation->name,
            $dynastyTranslation->also_known_as,
            $dynastyTranslation->area,
            $dynastyTranslation->history,
            $dynastyTranslation->date_description_ah,
            $dynastyTranslation->date_description_ad,
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
