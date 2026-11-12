<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The items a publication cites that are not reached through the
     * collections it accompanies.
     */
    public function up(): void
    {
        Schema::create('publication_item', function (Blueprint $table) {
            $table->uuid('publication_id');
            $table->uuid('item_id');
            $table->integer('display_order')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->foreign('publication_id')->references('id')->on('publications')->onDelete('cascade');
            $table->foreign('item_id')->references('id')->on('items')->onDelete('cascade');

            $table->primary(['publication_id', 'item_id']);
            $table->index('item_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('publication_item');
    }
};
