<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 B7 (#2690): the texts that were still in `item_translations.extra`.
 *
 * - `image_translations.copyright` and `photographer`: a picture's own credit
 *   and photographer in one language, as written, where its language rows
 *   were not all equal (the image row keeps the main text).
 * - `item_translations.original_name`: Sharing History's name in the item's
 *   original language (legacy `third_name`).
 * - `item_translations.archival_reference`: Sharing History's archival
 *   reference or source citation (legacy `archival`).
 * - `item_translations.holder_original_name`: the holding institution's name
 *   in its own language (legacy `holding_institution_org`), next to `holder`.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('image_translations', function (Blueprint $table) {
            $table->text('copyright')->nullable()->after('location');
            $table->text('photographer')->nullable()->after('copyright');
        });

        Schema::table('item_translations', function (Blueprint $table) {
            $table->text('original_name')->nullable()->after('alternate_name');
            $table->text('holder_original_name')->nullable()->after('holder');
            $table->text('archival_reference')->nullable()->after('bibliography');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $table->dropColumn(['original_name', 'holder_original_name', 'archival_reference']);
        });

        Schema::table('image_translations', function (Blueprint $table) {
            $table->dropColumn(['copyright', 'photographer']);
        });
    }
};
