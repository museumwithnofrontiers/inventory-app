<?php

namespace App\Listeners;

use App\Events\SpellingSaved;
use App\Jobs\SyncSpellingToDynastyTranslations;

class DispatchSyncSpellingToDynastyTranslations
{
    /**
     * Handle the event.
     */
    public function handle(SpellingSaved $event): void
    {
        SyncSpellingToDynastyTranslations::dispatch($event->spelling->id);
    }
}
