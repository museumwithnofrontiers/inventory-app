<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 E3 (#2649): links from one collection to another, by kind
 * (App\Enums\CollectionRelationKind), in the order legacy lists them: an
 * Explore itinerary's locations and territories, a region's themes, a
 * location's other regions and its historical background. Were id lists in
 * `extra`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('collection_collection', function (Blueprint $table) {
            $table->uuid('collection_id');
            $table->uuid('related_collection_id');
            $table->string('kind');
            $table->unsignedInteger('display_order')->default(1);
            $table->timestamps();

            $table->primary(['collection_id', 'related_collection_id', 'kind'], 'collection_collection_pk');
            $table->index(['related_collection_id', 'kind']);
            $table->foreign('collection_id')->references('id')->on('collections')->cascadeOnDelete();
            $table->foreign('related_collection_id')->references('id')->on('collections')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collection_collection');
    }
};
