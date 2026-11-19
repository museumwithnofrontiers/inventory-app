<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 C2 (#2642): a placement's own texts, one row per language.
 *
 * A placement (an item on a collection, `collection_item`) carries texts of
 * its own: the same item placed on two themes has two descriptions and two
 * captions (decision 4 (a), #2625). Each legacy field has its own column, as
 * written; none is merged into another:
 * - `title`: the detail view's name (legacy `detail_name`);
 * - `description`: the placement's text (legacy `contextual_descriptions` on
 *   thematic gallery themes, `detail_justification` on mwnf3 exhibition pages;
 *   a placement has one or the other);
 * - `curator_justification`, `partner_justification`: Sharing History's two
 *   justifications; `justification`: the National Context's single one;
 * - `caption`: the image caption (legacy `image_captions`);
 * - `item_name`, `item_date`, `item_location`, `item_museum`, `item_dynasty`,
 *   `item_artist`, `item_material`: the caption of the item on that page
 *   (C3, #2643: the dynasty and artist lines as written, decision 1 (a));
 * - `backward_compatibility`: the text's own legacy key
 *   (legacy `source_bc_by_language`).
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('collection_item_translations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('collection_item_id');
            $table->string('language_id', 3);

            $table->string('title')->nullable();
            $table->text('description')->nullable();
            $table->text('curator_justification')->nullable();
            $table->text('partner_justification')->nullable();
            $table->text('justification')->nullable();
            $table->text('caption')->nullable();
            $table->text('item_name')->nullable();
            $table->text('item_date')->nullable();
            $table->text('item_location')->nullable();
            $table->text('item_museum')->nullable();
            $table->text('item_dynasty')->nullable();
            $table->text('item_artist')->nullable();
            $table->text('item_material')->nullable();

            $table->string('backward_compatibility')->nullable()->index();
            $table->timestamps();

            $table->foreign('collection_item_id')->references('id')->on('collection_item')->cascadeOnDelete();
            $table->foreign('language_id')->references('id')->on('languages')->cascadeOnDelete();

            $table->unique(['collection_item_id', 'language_id'], 'ci_tr_placement_lang_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('collection_item_translations');
    }
};
