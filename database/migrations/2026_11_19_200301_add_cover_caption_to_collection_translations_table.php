<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 F2 (#2652): an exhibition's cover picture caption, as legacy wrote it
 * (`sh_exhibitionnames.cover_images`, one field). Nothing says which of the
 * exhibition's images is the cover, so the text belongs to the translation,
 * not to a guessed image.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('collection_translations', function (Blueprint $table) {
            $table->text('cover_caption')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('collection_translations', function (Blueprint $table) {
            $table->dropColumn('cover_caption');
        });
    }
};
