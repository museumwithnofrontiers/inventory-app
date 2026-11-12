<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A publication's text in one language and context. The credits are the
     * lines as printed, never split into Author records.
     */
    public function up(): void
    {
        Schema::create('publication_translations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('publication_id');
            $table->string('language_id', 3);
            $table->uuid('context_id');

            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->text('description')->nullable();
            $table->text('introduction')->nullable();
            $table->text('author_credit')->nullable();
            $table->text('photography_credit')->nullable();
            $table->text('coordination_credit')->nullable();

            $table->string('backward_compatibility')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->foreign('publication_id')->references('id')->on('publications')->cascadeOnDelete();
            $table->foreign('language_id')->references('id')->on('languages')->cascadeOnDelete();
            $table->foreign('context_id')->references('id')->on('contexts')->cascadeOnDelete();

            $table->unique(['publication_id', 'language_id', 'context_id'], 'pub_tr_pub_lang_ctx_unique');
            $table->index(['language_id', 'context_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('publication_translations');
    }
};
