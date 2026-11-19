<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 E3 (#2649):
 * - `cover_item_id`: the picture a thematic gallery theme shows as its cover
 *   (was `extra.thg_theme.cover_picture`);
 * - `days`: a Travels itinerary's number of days (was `extra.days`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('collections', function (Blueprint $table) {
            $table->uuid('cover_item_id')->nullable()->after('country_id');
            $table->unsignedSmallInteger('days')->nullable()->after('cover_item_id');

            $table->foreign('cover_item_id')->references('id')->on('items')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('collections', function (Blueprint $table) {
            $table->dropForeign(['cover_item_id']);
            $table->dropColumn(['cover_item_id', 'days']);
        });
    }
};
