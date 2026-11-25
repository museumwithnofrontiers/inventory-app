<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * `collections.type` becomes a plain string column (#2794). Its values are
 * held by App\Enums\CollectionType and the model's cast, like every other
 * fixed-list column; the database no longer keeps its own copy of the list.
 * No row changes.
 *
 * `collections.purpose` is already a string; from now on the model casts it
 * to App\Enums\CollectionPurpose. A stored value outside that list would make
 * every page showing the collection fail, so the migration stops first and
 * names the values to fix.
 */
return new class extends Migration
{
    /** App\Enums\CollectionPurpose's values when this migration was written. */
    private const PURPOSES = [
        'exhibitions-root',
        'artistic-introduction-root',
        'historical-profiles-root',
        'historical-background-root',
        'topics-root',
        'galleries-root',
        'travels-root',
        'explore-root',
        'explore-themes-root',
        'explore-countries-root',
        'explore-itineraries-root',
        'national-context',
    ];

    public function up(): void
    {
        $unknown = DB::table('collections')
            ->whereNotNull('purpose')
            ->whereNotIn('purpose', self::PURPOSES)
            ->distinct()
            ->pluck('purpose');

        if ($unknown->isNotEmpty()) {
            throw new RuntimeException('collections.purpose holds values outside CollectionPurpose: '.$unknown->implode(', '));
        }

        Schema::table('collections', function (Blueprint $table) {
            $table->string('type')->default('collection')->change();
        });
    }

    public function down(): void
    {
        Schema::table('collections', function (Blueprint $table) {
            $table->enum('type', [
                'collection',
                'exhibition',
                'gallery',
                'theme',
                'exhibition trail',
                'itinerary',
                'location',
                'subtheme',
                'region',
            ])->default('collection')->change();
        });
    }
};
