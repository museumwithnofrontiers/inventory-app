<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M17 C1 and C2 (#2747, #2748, epic #2741, decisions 10 and 11).
 *
 * `partners.visible` goes. The importer wrote it by source (always off for the
 * mwnf3 museums and institutions, always on for Sharing History's partners), no
 * exporter read it, and every partner list reads the participation's
 * `collection_partner.visible`, which stays. The one value from legacy,
 * `thg_gallery.exhibition_partner.visible` (UNAOC hidden on The Use of Colours
 * in Art), is not kept: legacy's exhibitions client never reads it and lists
 * every partner.
 *
 * `projects.is_launched` and `projects.is_enabled` go: no exporter read them,
 * and the inventory doesn't work out whether a project is visible.
 * `launch_date` stays: the date MWNF started the work.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('partners', function (Blueprint $table) {
            $table->dropColumn('visible');
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn(['is_launched', 'is_enabled']);
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->boolean('is_launched')->default(false)->after('launch_date');
            $table->boolean('is_enabled')->default(true)->after('is_launched');
        });

        Schema::table('partners', function (Blueprint $table) {
            $table->boolean('visible')->default(false)->after('monument_item_id');
        });
    }
};
