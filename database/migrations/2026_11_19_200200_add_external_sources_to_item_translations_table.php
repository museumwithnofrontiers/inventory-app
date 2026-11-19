<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 F3 (#2653): a monument's external sources as legacy wrote them: a
 * display text, with its links and photo credits inside it. No Link is
 * derived from it (ADR 006 rule 2).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $table->text('external_sources')->nullable()->after('image_rights');
        });
    }

    public function down(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $table->dropColumn('external_sources');
        });
    }
};
