<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Registry tables: also indexed on `path`, looked up by filename when
     * serving the public copy (M9 §10 "Image-serving endpoint").
     *
     * @var list<string>
     */
    private const REGISTRY_TABLES = [
        'item_images',
        'collection_images',
        'partner_images',
        'partner_translation_images',
        'contributor_images',
        'timeline_event_images',
        'partner_logos',
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('available_images', function (Blueprint $table) {
            $table->string('copyright', 500)->nullable()->after('comment');
        });

        foreach (self::REGISTRY_TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->string('copyright', 500)->nullable()->after('alt_text');
                $table->index('path');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('available_images', function (Blueprint $table) {
            $table->dropColumn('copyright');
        });

        foreach (self::REGISTRY_TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                $table->dropIndex($tableName.'_path_index');
                $table->dropColumn('copyright');
            });
        }
    }
};
