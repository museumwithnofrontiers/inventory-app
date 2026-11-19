<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 B3 (#2637): the Workshop model leaves. Nothing ever wrote its tables:
 * legacy has no workshop table, so the importer never created one, and the
 * workshop line the sheets print is display text on the item translation
 * (`item_translations.workshop`, B2/B3).
 *
 * The down migration recreates both tables as they were, empty.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('item_workshop');
        Schema::dropIfExists('workshops');
    }

    public function down(): void
    {
        Schema::create('workshops', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('internal_name')->unique();
            $table->string('backward_compatibility')->nullable()->default(null);
            $table->timestamps();

            $table->index('name');
            $table->index('internal_name');
        });

        Schema::create('item_workshop', function (Blueprint $table) {
            $table->uuid('item_id');
            $table->uuid('workshop_id');
            $table->timestamps();

            $table->foreign('item_id')->references('id')->on('items')->onDelete('cascade');
            $table->foreign('workshop_id')->references('id')->on('workshops')->onDelete('cascade');

            $table->primary(['item_id', 'workshop_id']);
        });
    }
};
