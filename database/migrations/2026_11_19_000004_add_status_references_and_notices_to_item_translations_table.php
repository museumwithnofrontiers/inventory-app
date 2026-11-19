<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 B5 (#2639), B6 (#2640) and the rights line F1 (#2651) fills:
 * - `status`: the editorial state (published, unedited, hidden);
 * - display texts as legacy wrote them: the catalogue references (codes and
 *   free-text citations alike; the Book links are separate), the two Sharing
 *   History notices, and the sheet's per-language image rights line.
 * No status or link is derived from these texts (ADR 006).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $table->string('status', 16)->default('published')->after('context_id')->index();
            $table->text('catalogue_references')->nullable()->after('history');
            $table->text('notice')->nullable()->after('catalogue_references');
            $table->text('external_notice')->nullable()->after('notice');
            $table->text('image_rights')->nullable()->after('architects');
        });
    }

    public function down(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn(['status', 'catalogue_references', 'notice', 'external_notice', 'image_rights']);
        });
    }
};
