<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A publication: the work (legacy bookbase), whatever its editions.
     */
    public function up(): void
    {
        Schema::create('publications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('internal_name');
            $table->string('backward_compatibility')->nullable()->unique();
            // App\Enums\PublicationCategory
            $table->string('category');
            $table->uuid('project_id')->nullable();
            $table->string('country_id', 3)->nullable();
            // The work's main language
            $table->string('language_id', 3);
            // App\Enums\PublicationStatus
            $table->string('status')->default('published');
            $table->integer('display_order')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->foreign('project_id')->references('id')->on('projects')->nullOnDelete();
            $table->foreign('country_id')->references('id')->on('countries')->nullOnDelete();
            $table->foreign('language_id')->references('id')->on('languages')->cascadeOnDelete();

            $table->index('category');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('publications');
    }
};
