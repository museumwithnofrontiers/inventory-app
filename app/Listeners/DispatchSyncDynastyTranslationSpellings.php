<?php

namespace App\Listeners;

use App\Events\DynastyTranslationSaved;
use App\Jobs\SyncDynastyTranslationSpellings;

class DispatchSyncDynastyTranslationSpellings
{
    /**
     * Handle the event.
     */
    public function handle(DynastyTranslationSaved $event): void
    {
        SyncDynastyTranslationSpellings::dispatch($event->dynastyTranslation->id);
    }
}
