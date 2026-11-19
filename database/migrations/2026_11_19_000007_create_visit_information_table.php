<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 D1 (#2645, decision 5 (a)): visit information, one shared model.
 *
 * How to reach a place, its opening hours, its contact, address and
 * institution, practical information, phone, fax, e-mail and website, per
 * language and context, as written. It belongs to exactly one owner: an item
 * (a monument), a collection (a travel location) or a partner. The model
 * guards that exactly one of the three is set.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('visit_information', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('item_id')->nullable();
            $table->uuid('collection_id')->nullable();
            $table->uuid('partner_id')->nullable();
            $table->string('language_id', 3);
            $table->uuid('context_id');

            $table->text('how_to_reach')->nullable();
            $table->text('opening_hours')->nullable();
            $table->text('contact')->nullable();
            $table->text('address')->nullable();
            $table->text('institution')->nullable();
            $table->text('practical_information')->nullable();
            $table->text('phone')->nullable();
            $table->text('fax')->nullable();
            $table->text('email')->nullable();
            $table->text('website')->nullable();

            $table->string('backward_compatibility')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->foreign('item_id')->references('id')->on('items')->cascadeOnDelete();
            $table->foreign('collection_id')->references('id')->on('collections')->cascadeOnDelete();
            $table->foreign('partner_id')->references('id')->on('partners')->cascadeOnDelete();
            $table->foreign('language_id')->references('id')->on('languages')->cascadeOnDelete();
            $table->foreign('context_id')->references('id')->on('contexts')->cascadeOnDelete();

            $table->unique(['item_id', 'language_id', 'context_id'], 'visit_info_item_lang_ctx_unique');
            $table->unique(['collection_id', 'language_id', 'context_id'], 'visit_info_coll_lang_ctx_unique');
            $table->unique(['partner_id', 'language_id', 'context_id'], 'visit_info_partner_lang_ctx_unique');
            $table->index(['language_id', 'context_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('visit_information');
    }
};
