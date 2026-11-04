<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('dynasty_translation_spelling', function (Blueprint $table) {
            $table->uuid('dynasty_translation_id');
            $table->uuid('spelling_id');
            $table->timestamps();

            // Foreign key constraints
            $table->foreign('dynasty_translation_id', 'dt_spelling_dt_fk')->references('id')->on('dynasty_translations')->onDelete('cascade');
            $table->foreign('spelling_id', 'dt_spelling_spelling_fk')->references('id')->on('glossary_spellings')->onDelete('cascade');

            // Unique constraint: prevent duplicate links
            $table->unique(['dynasty_translation_id', 'spelling_id'], 'dt_spelling_unique');

            // Index for reverse lookups
            $table->index(['spelling_id', 'dynasty_translation_id'], 'spelling_dt_index');

            // Primary key
            $table->primary(['dynasty_translation_id', 'spelling_id'], 'dt_spelling_primary');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dynasty_translation_spelling');
    }
};
