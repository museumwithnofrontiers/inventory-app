<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Legacy writes alternate names and types longer than 255 characters (a
     * list of wax statues, a paragraph on a Japanese screen). The import cut
     * them, and the sites printed the cut text with "…". Text columns keep
     * them whole.
     */
    public function up(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $table->text('alternate_name')->nullable()->change();
            $table->text('type')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('item_translations', function (Blueprint $table) {
            $table->string('alternate_name')->nullable()->change();
            $table->string('type')->nullable()->change();
        });
    }
};
