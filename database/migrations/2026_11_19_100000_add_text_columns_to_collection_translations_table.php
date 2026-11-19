<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 E1 (#2647): the collection translation texts that sat in `extra` get
 * columns of their own, named like Publication's, each holding the text as
 * written (ADR 006):
 * - `subtitle`;
 * - `introduction`: mwnf3's exhibition `intro_text` and Travels' itinerary
 *   `introduction`, two names for one text;
 * - `duration`: an Explore trail's duration ("One day").
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('collection_translations', function (Blueprint $table) {
            $table->text('subtitle')->nullable()->after('title');
            $table->text('introduction')->nullable()->after('description');
            $table->string('duration')->nullable()->after('quote');
        });
    }

    public function down(): void
    {
        Schema::table('collection_translations', function (Blueprint $table) {
            $table->dropColumn(['subtitle', 'introduction', 'duration']);
        });
    }
};
