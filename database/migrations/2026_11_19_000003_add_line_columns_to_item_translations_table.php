<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 B2 (#2636) and B3 (#2637): the keyword line and the artist, workshop,
 * scribe, patron and architect lines as the sheets print them. They are
 * display texts: the Tags and the Artist links document the same subjects
 * separately, and neither is derived from the other (ADR 006).
 */
return new class extends Migration
{
    private const COLUMNS = [
        'keywords',
        'artist',
        'artist_period_of_activity',
        'artist_birth_date',
        'artist_birth_place',
        'artist_death_date',
        'artist_death_place',
        'workshop',
        'scribe',
        'patrons',
        'architects',
    ];

    public function up(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $after = 'dynasty';
            foreach (self::COLUMNS as $column) {
                $table->text($column)->nullable()->after($after);
                $after = $column;
            }
        });
    }

    public function down(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $table->dropColumn(self::COLUMNS);
        });
    }
};
