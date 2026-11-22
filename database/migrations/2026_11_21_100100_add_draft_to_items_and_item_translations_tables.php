<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M17 B1 (#2744, epic #2741, decisions 7 and 8): an item, or one of its texts,
 * that isn't ready for any site is a draft. No exporter ships a draft item, its
 * details or pictures, or a draft text; the API and the MCP server return them
 * with their `draft` flag.
 *
 * Legacy has no such flag, so every row starts off. `item_translations.status`
 * is not read for it: its `hidden` is Sharing History's "illustration only"
 * flag, not a draft (M17 B2, #2745). The panel starts a new item or text as a
 * draft.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->boolean('draft')->default(false)->after('type');
            $table->index('draft');
        });

        Schema::table('item_translations', function (Blueprint $table) {
            $table->boolean('draft')->default(false)->after('context_id');
            $table->index('draft');
        });
    }

    public function down(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $table->dropIndex(['draft']);
            $table->dropColumn('draft');
        });

        Schema::table('items', function (Blueprint $table) {
            $table->dropIndex(['draft']);
            $table->dropColumn('draft');
        });
    }
};
