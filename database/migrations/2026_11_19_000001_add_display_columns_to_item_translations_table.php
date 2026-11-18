<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 B1 (#2635): the item translation texts that sat in `extra` get columns
 * of their own, each holding the text as written (ADR 006):
 * - `short_description`: legacy's `description2`;
 * - `materials`, `dynasty` (next to the Dynasty links), `region` (legacy's `province`);
 * - `history`: a monument's history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $table->text('short_description')->nullable()->after('description');
            $table->text('materials')->nullable()->after('dimensions');
            $table->text('dynasty')->nullable()->after('materials');
            $table->text('region')->nullable()->after('location');
            $table->text('history')->nullable()->after('bibliography');
        });
    }

    public function down(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $table->dropColumn(['short_description', 'materials', 'dynasty', 'region', 'history']);
        });
    }
};
