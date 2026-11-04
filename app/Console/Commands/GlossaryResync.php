<?php

namespace App\Console\Commands;

use App\Jobs\SyncSpellingToCollectionTranslations;
use App\Jobs\SyncSpellingToDynastyTranslations;
use App\Jobs\SyncSpellingToItemTranslations;
use App\Jobs\SyncSpellingToTimelineEventTranslations;
use App\Models\GlossarySpelling;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class GlossaryResync extends Command
{
    /**
     * The name and signature of the console command.
     *
     * --remove-existing : Remove existing relationships before queuing
     * --chunk= : Number of words per chunk (default 100)
     * --queue= : Override dispatch queue name (default: job-specific queue)
     * --force : Skip confirmation prompts
     *
     * @var string
     */
    protected $signature = 'glossary:resync {--remove-existing : Remove existing spelling-translation relationships before queuing} {--chunk=100 : Words per chunk} {--queue= : Queue name to dispatch jobs to} {--force : Skip confirmation prompt}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Re-synchronise glossary spellings to item, collection, timeline event, and dynasty translations (removes existing links optionally and queues sync jobs in chunks). Refer to laravel artisan queue:work for more info how to run the queue.';

    public function handle(): int
    {
        $remove = $this->option('remove-existing');
        $chunk = (int) $this->option('chunk');
        $queue = $this->option('queue');
        $force = $this->option('force');

        if ($remove) {
            if (! $force && ! $this->confirm('This will REMOVE ALL rows from item_translation_spelling, collection_translation_spelling, timeline_event_translation_spelling, and dynasty_translation_spelling. Continue?')) {
                $this->info('Aborted. No changes were made.');

                return 1;
            }

            DB::table('item_translation_spelling')->delete();
            DB::table('collection_translation_spelling')->delete();
            DB::table('timeline_event_translation_spelling')->delete();
            DB::table('dynasty_translation_spelling')->delete();
            $this->info('Removed existing spelling-translation relationships.');
        }

        // Get distinct glossary IDs that have spellings
        $glossaryIds = DB::table('glossary_spellings')
            ->select('glossary_id')
            ->distinct()
            ->orderBy('glossary_id')
            ->pluck('glossary_id')
            ->toArray();

        $totalWords = count($glossaryIds);

        if ($totalWords === 0) {
            $this->info('No glossary spellings found. Nothing to do.');

            return 0;
        }

        $this->info("Dispatching jobs for {$totalWords} words (chunk size: {$chunk})...");

        $batches = array_chunk($glossaryIds, max(1, $chunk));
        $bar = $this->output->createProgressBar($totalWords);
        $bar->start();

        foreach ($batches as $batch) {
            foreach ($batch as $glossaryId) {
                $spellings = GlossarySpelling::where('glossary_id', $glossaryId)->get();

                foreach ($spellings as $spelling) {
                    $itemDispatch = SyncSpellingToItemTranslations::dispatch($spelling->id);
                    if ($queue) {
                        $itemDispatch->onQueue($queue);
                    }

                    $collectionDispatch = SyncSpellingToCollectionTranslations::dispatch($spelling->id);
                    if ($queue) {
                        $collectionDispatch->onQueue($queue);
                    }

                    $timelineDispatch = SyncSpellingToTimelineEventTranslations::dispatch($spelling->id);
                    if ($queue) {
                        $timelineDispatch->onQueue($queue);
                    }

                    $dynastyDispatch = SyncSpellingToDynastyTranslations::dispatch($spelling->id);
                    if ($queue) {
                        $dynastyDispatch->onQueue($queue);
                    }
                }

                $bar->advance();
            }

            // Small pause to avoid overwhelming queue/backends if desired
            // usleep(1000); // Uncomment if needed
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Dispatched jobs for {$totalWords} words successfully.");

        return 0;
    }
}
