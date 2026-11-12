<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The collections a publication accompanies (an exhibition trail, later
     * an exhibition or a gallery).
     */
    public function up(): void
    {
        Schema::create('publication_collection', function (Blueprint $table) {
            $table->uuid('publication_id');
            $table->uuid('collection_id');
            $table->integer('display_order')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->foreign('publication_id')->references('id')->on('publications')->onDelete('cascade');
            $table->foreign('collection_id')->references('id')->on('collections')->onDelete('cascade');

            $table->primary(['publication_id', 'collection_id']);
            $table->index('collection_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('publication_collection');
    }
};
