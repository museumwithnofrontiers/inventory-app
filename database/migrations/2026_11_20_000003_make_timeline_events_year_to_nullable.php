<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A timeline event may have no end year (M16 G2, #2697): legacy leaves some
 * empty (Sharing History sh_hcr 1497), which the importer wrote as 0.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('timeline_events', function (Blueprint $table) {
            $table->integer('year_to')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('timeline_events', function (Blueprint $table) {
            $table->integer('year_to')->nullable(false)->change();
        });
    }
};
