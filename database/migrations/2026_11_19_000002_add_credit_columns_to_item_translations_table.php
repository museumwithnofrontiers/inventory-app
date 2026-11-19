<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 B4 (#2638, Decision 2 (b)): the credits as legacy wrote them, next to
 * the Author links. Named like Publication's `author_credit`. The Author links
 * drive the indexes; these texts are what the item sheets print.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $table->text('author_credit')->nullable()->after('translation_copy_editor_id');
            $table->text('copy_editor_credit')->nullable()->after('author_credit');
            $table->text('translator_credit')->nullable()->after('copy_editor_credit');
            $table->text('translation_copy_editor_credit')->nullable()->after('translator_credit');
        });
    }

    public function down(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $table->dropColumn(['author_credit', 'copy_editor_credit', 'translator_credit', 'translation_copy_editor_credit']);
        });
    }
};
