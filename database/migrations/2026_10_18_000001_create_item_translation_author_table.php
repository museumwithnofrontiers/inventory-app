<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Every person credited on an item translation, per role and in order.
     * Legacy credits several people per (item, language, role) and prints them
     * all; the single author FK per role on item_translations keeps only the
     * first. Those FKs stay until every consumer reads this list.
     */
    public function up(): void
    {
        Schema::create('item_translation_author', function (Blueprint $table) {
            $table->uuid('item_translation_id');
            $table->string('role', 32);
            $table->uuid('author_id');
            $table->unsignedSmallInteger('display_order')->default(0);
            $table->timestamps();

            // The same person may hold two roles on one translation, never one role twice.
            $table->primary(['item_translation_id', 'role', 'author_id']);

            $table->foreign('item_translation_id')->references('id')->on('item_translations')->onDelete('cascade');
            $table->foreign('author_id')->references('id')->on('authors')->onDelete('cascade');

            $table->index('author_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('item_translation_author');
    }
};
