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
 * One call per table, as the tables are today, so that Larastan reads the
 * columns; a test checks every AttachedImageRegistry table has both.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('available_images', function (Blueprint $table) {
            $table->string('photographer')->nullable()->after('copyright');
            $table->string('credit', 500)->nullable()->after('photographer');
        });
        Schema::table('item_images', function (Blueprint $table) {
            $table->string('photographer')->nullable()->after('copyright');
            $table->string('credit', 500)->nullable()->after('photographer');
        });
        Schema::table('collection_images', function (Blueprint $table) {
            $table->string('photographer')->nullable()->after('copyright');
            $table->string('credit', 500)->nullable()->after('photographer');
        });
        Schema::table('partner_images', function (Blueprint $table) {
            $table->string('photographer')->nullable()->after('copyright');
            $table->string('credit', 500)->nullable()->after('photographer');
        });
        Schema::table('partner_translation_images', function (Blueprint $table) {
            $table->string('photographer')->nullable()->after('copyright');
            $table->string('credit', 500)->nullable()->after('photographer');
        });
        Schema::table('contributor_images', function (Blueprint $table) {
            $table->string('photographer')->nullable()->after('copyright');
            $table->string('credit', 500)->nullable()->after('photographer');
        });
        Schema::table('timeline_event_images', function (Blueprint $table) {
            $table->string('photographer')->nullable()->after('copyright');
            $table->string('credit', 500)->nullable()->after('photographer');
        });
        Schema::table('publication_images', function (Blueprint $table) {
            $table->string('photographer')->nullable()->after('copyright');
            $table->string('credit', 500)->nullable()->after('photographer');
        });
        Schema::table('partner_logos', function (Blueprint $table) {
            $table->string('photographer')->nullable()->after('copyright');
            $table->string('credit', 500)->nullable()->after('photographer');
        });
    }

    public function down(): void
    {
        Schema::table('available_images', function (Blueprint $table) {
            $table->dropColumn(['photographer', 'credit']);
        });
        Schema::table('item_images', function (Blueprint $table) {
            $table->dropColumn(['photographer', 'credit']);
        });
        Schema::table('collection_images', function (Blueprint $table) {
            $table->dropColumn(['photographer', 'credit']);
        });
        Schema::table('partner_images', function (Blueprint $table) {
            $table->dropColumn(['photographer', 'credit']);
        });
        Schema::table('partner_translation_images', function (Blueprint $table) {
            $table->dropColumn(['photographer', 'credit']);
        });
        Schema::table('contributor_images', function (Blueprint $table) {
            $table->dropColumn(['photographer', 'credit']);
        });
        Schema::table('timeline_event_images', function (Blueprint $table) {
            $table->dropColumn(['photographer', 'credit']);
        });
        Schema::table('publication_images', function (Blueprint $table) {
            $table->dropColumn(['photographer', 'credit']);
        });
        Schema::table('partner_logos', function (Blueprint $table) {
            $table->dropColumn(['photographer', 'credit']);
        });
    }
};
