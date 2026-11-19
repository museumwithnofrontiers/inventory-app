<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 E3 (#2649): the countries a collection covers besides its main country
 * (`collections.country_id`), in the order legacy lists them. Was
 * `collection_translations.extra.country_ids`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('collection_country', function (Blueprint $table) {
            $table->uuid('collection_id');
            $table->string('country_id', 3);
            $table->unsignedInteger('display_order')->default(1);
            $table->timestamps();

            $table->primary(['collection_id', 'country_id']);
            $table->foreign('collection_id')->references('id')->on('collections')->cascadeOnDelete();
            $table->foreign('country_id')->references('id')->on('countries')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collection_country');
    }
};
