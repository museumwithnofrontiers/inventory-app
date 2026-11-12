<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The seventh attached-image table: the item_images columns, owned by a
     * publication, and optionally the cover of one of its editions.
     */
    public function up(): void
    {
        Schema::create('publication_images', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('publication_id');
            // The edition whose cover this is, if any
            $table->uuid('publication_edition_id')->nullable();
            // App\Enums\PublicationImageKind
            $table->string('kind');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type');
            $table->bigInteger('size');
            $table->string('alt_text')->nullable();
            $table->string('copyright', 500)->nullable();
            $table->integer('display_order')->default(0);
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->foreign('publication_id')->references('id')->on('publications')->cascadeOnDelete();
            $table->foreign('publication_edition_id')->references('id')->on('publication_editions')->nullOnDelete();

            $table->index(['publication_id', 'display_order']);
            $table->index(['publication_id', 'kind']);
            $table->index('path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('publication_images');
    }
};
