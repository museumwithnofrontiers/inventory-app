<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 F1 (#2651, Decision 3 (b)): the picture's photographer and its own
 * credit line, next to `copyright`. `copyright` stays the text burned on the
 * picture (image → Project → fallback, untouched); `credit` holds the
 * picture's own text where that is not the burned one, e.g. on ISL and IAM
 * pictures, which burn their project's line. Metadata only.
 *
 * A migration is a snapshot, so the tables are listed as they are today; a
 * test checks every AttachedImageRegistry table has both columns.
 */
return new class extends Migration
{
    /** @var list<string> */
    private const TABLES = [
        'available_images',
        'item_images',
        'collection_images',
        'partner_images',
        'partner_translation_images',
        'contributor_images',
        'timeline_event_images',
        'publication_images',
        'partner_logos',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->string('photographer')->nullable()->after('copyright');
                $table->string('credit', 500)->nullable()->after('photographer');
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn(['photographer', 'credit']);
            });
        }
    }
};
