<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 F2 (#2652): an image's texts in one language, for any model of the
 * AttachedImageRegistry (and an AvailableImage, so they survive the
 * attach/detach row swap). The image row keeps its single `alt_text`:
 * giving it a language would be a guess.
 *
 * `caption` is a caption as legacy wrote it; `name`, `date`, `museum` and
 * `location` are the parts of a caption legacy kept as separate fields, each
 * as written: never joined into one text.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('image_translations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('image_type', 64);
            $table->uuid('image_id');
            $table->string('language_id', 3);
            $table->text('caption')->nullable();
            $table->text('name')->nullable();
            $table->text('date')->nullable();
            $table->text('museum')->nullable();
            $table->text('location')->nullable();
            $table->string('backward_compatibility')->nullable();
            $table->timestamps();

            $table->foreign('language_id')->references('id')->on('languages')->onDelete('cascade');
            $table->unique(['image_type', 'image_id', 'language_id']);
            $table->index('image_id');
            $table->index('backward_compatibility');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('image_translations');
    }
};
