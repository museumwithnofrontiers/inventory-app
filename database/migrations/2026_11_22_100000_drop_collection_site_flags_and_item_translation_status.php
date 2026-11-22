<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M17 D1 (#2750, epic #2741): the removal step, after the additive stories and
 * a reimport.
 *
 * - `collections.visible` gave way to `draft` (A1); `featured` and
 *   `published_at` are site configuration in the gallery instance files (A2).
 * - `item_translations.status` gave way to `draft` (B1); its `hidden` is
 *   Sharing History's `sh_display_status` in `extra` (B2), and `unedited` was
 *   never imported.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('collections', function (Blueprint $table) {
            $table->dropIndex(['visible']);
            $table->dropColumn(['visible', 'featured', 'published_at']);
        });

        Schema::table('item_translations', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn('status');
        });
    }

    public function down(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $table->string('status', 16)->default('published')->after('context_id')->index();
        });

        Schema::table('collections', function (Blueprint $table) {
            $table->boolean('visible')->default(true)->after('days');
            $table->boolean('featured')->default(false)->after('visible');
            $table->date('published_at')->nullable()->after('featured');
            $table->index('visible');
        });
    }
};
