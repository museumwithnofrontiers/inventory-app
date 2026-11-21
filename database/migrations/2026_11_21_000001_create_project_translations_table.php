<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A project's name in each language. A Project had only an `internal_name`;
 * the sites' source chips need its name as written for each language, and a
 * project made in the panel had nowhere to keep it.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('project_translations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained()->cascadeOnDelete();
            $table->string('language_id', 3);
            $table->foreign('language_id')->references('id')->on('languages')->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();

            $table->unique(['project_id', 'language_id'], 'project_translations_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_translations');
    }
};
