<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 C4 (#2644): Explore's monuments on a placement.
 *
 * Explore lists its monuments by its own ids, which the model doesn't hold:
 * an Explore monument merged into a Travels or mwnf3 record has no item of
 * its own, and one placed item can stand for several of them. So each
 * Explore monument a placement stands for is a row of the placement
 * (decision on #2644):
 * - `position`: its place in the placement's list, as written;
 * - `backward_compatibility`: its legacy key, `mwnf3_explore:monument:<id>`;
 * - `latitude`, `longitude`, `map_zoom`: its coordinates, as written;
 * - `location_collection_id`: on an itinerary, the Explore location the
 *   monument is visited in;
 * - `description_types`, `travels_description_ref`, `explore_description_ref`,
 *   `virtual_museum_description_ref`: on an itinerary, the legacy references
 *   to the texts legacy showed for the monument, as written. No exporter or
 *   site reads them today; they are kept so nothing is lost.
 *
 * Its museums (legacy `explore_museums`) are partners, in order.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('collection_item_explore_monuments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('collection_item_id');
            $table->unsignedInteger('position');
            $table->string('backward_compatibility');

            $table->double('latitude')->nullable();
            $table->double('longitude')->nullable();
            $table->integer('map_zoom')->nullable();

            $table->foreignUuid('location_collection_id')->nullable()
                ->constrained('collections')->nullOnDelete();

            $table->string('description_types')->nullable();
            $table->string('travels_description_ref')->nullable();
            $table->string('explore_description_ref')->nullable();
            $table->string('virtual_museum_description_ref')->nullable();

            $table->timestamps();

            $table->foreign('collection_item_id')->references('id')->on('collection_item')->cascadeOnDelete();
            // Not unique: the panel rewrites the positions one row at a time when it reorders them.
            $table->index(['collection_item_id', 'position'], 'ci_explore_placement_position_index');
            $table->index('backward_compatibility');
        });

        Schema::create('collection_item_explore_monument_partner', function (Blueprint $table) {
            $table->uuid('collection_item_explore_monument_id');
            $table->uuid('partner_id');
            $table->unsignedInteger('display_order')->nullable();
            $table->timestamps();

            $table->primary(['collection_item_explore_monument_id', 'partner_id'], 'ci_explore_partner_primary');
            $table->foreign('collection_item_explore_monument_id', 'ci_explore_partner_monument_foreign')
                ->references('id')->on('collection_item_explore_monuments')->cascadeOnDelete();
            $table->foreign('partner_id', 'ci_explore_partner_partner_foreign')
                ->references('id')->on('partners')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('collection_item_explore_monument_partner');
        Schema::dropIfExists('collection_item_explore_monuments');
    }
};
