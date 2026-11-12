<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One edition of a publication (legacy books): one language, publisher,
     * format and edition number. No translations, and nothing commercial.
     */
    public function up(): void
    {
        Schema::create('publication_editions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('publication_id');
            $table->string('language_id', 3);
            // App\Enums\PublicationFormat
            $table->string('format');
            $table->unsignedInteger('edition')->nullable();
            $table->smallInteger('publish_year')->nullable();
            $table->string('isbn')->nullable();
            // The publisher's name as text, never a model
            $table->string('publisher')->nullable();
            $table->integer('page_count')->nullable();
            $table->integer('image_count')->nullable();
            $table->integer('plan_count')->nullable();
            $table->string('dimensions')->nullable();
            $table->string('binding')->nullable();
            $table->boolean('visible')->default(true);
            $table->integer('display_order')->nullable();
            $table->string('backward_compatibility')->nullable()->unique();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->foreign('publication_id')->references('id')->on('publications')->cascadeOnDelete();
            $table->foreign('language_id')->references('id')->on('languages')->cascadeOnDelete();

            $table->index(['publication_id', 'display_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('publication_editions');
    }
};
