<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A publication's PDF (an edition's sample pages or its credits), on the
     * document pipeline: the file lives on the private documents disk and
     * is served publicly at /doc/{path} only (ADR 004).
     */
    public function up(): void
    {
        Schema::create('publication_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('publication_id');
            // The edition the document belongs to, if any
            $table->uuid('publication_edition_id')->nullable();
            $table->string('language_id', 3)->nullable();
            // App\Enums\PublicationDocumentKind
            $table->string('kind');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type');
            $table->bigInteger('size');
            $table->integer('display_order')->default(0);
            $table->string('backward_compatibility')->nullable()->unique();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->foreign('publication_id')->references('id')->on('publications')->cascadeOnDelete();
            $table->foreign('publication_edition_id')->references('id')->on('publication_editions')->nullOnDelete();
            $table->foreign('language_id')->references('id')->on('languages')->nullOnDelete();

            $table->index(['publication_id', 'display_order']);
            $table->index('path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('publication_documents');
    }
};
