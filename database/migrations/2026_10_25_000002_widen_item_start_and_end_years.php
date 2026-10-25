<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Legacy dates an object from the Paleolithic, -300000, which a SMALLINT
     * (-32768 to 32767) can't hold; the import left its start year empty, so
     * it fell out of the date filters and the timeline.
     */
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->integer('start_date')->nullable()->change();
            $table->integer('end_date')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->smallInteger('start_date')->nullable()->change();
            $table->smallInteger('end_date')->nullable()->change();
        });
    }
};
