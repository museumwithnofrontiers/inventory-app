<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 E4a (#2650, decision 6): the only editorial flags the inventory keeps
 * on a collection; the rest of the site configuration belongs to the sites.
 * - `visible`: legacy's exhibition `show` (y/n) and Explore theme status (e/i);
 * - `featured`: a thematic gallery shown among the featured galleries;
 * - `published_at`: a thematic gallery's live date.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('collections', function (Blueprint $table) {
            $table->boolean('visible')->default(true)->after('days');
            $table->boolean('featured')->default(false)->after('visible');
            $table->date('published_at')->nullable()->after('featured');

            $table->index('visible');
        });
    }

    public function down(): void
    {
        Schema::table('collections', function (Blueprint $table) {
            $table->dropIndex(['visible']);
            $table->dropColumn(['visible', 'featured', 'published_at']);
        });
    }
};
