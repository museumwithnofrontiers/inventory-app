<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M17 A1 (#2742, epic #2741, decision 3): a collection that isn't ready for
 * any site is a draft. A draft collection and everything under it ship
 * nowhere. Legacy's hidden exhibitions (`show = 'n'`) and Explore themes
 * (`status = 'i'`) import as drafts.
 *
 * `draft` starts as the opposite of `visible`. `visible` is dropped by M17 D1
 * (#2750). The column default is off, because the importer creates
 * collections that legacy shows; the panel starts a new collection as a draft.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('collections', function (Blueprint $table) {
            $table->boolean('draft')->default(false)->after('days');
            $table->index('draft');
        });

        DB::table('collections')->where('visible', false)->update(['draft' => true]);
    }

    public function down(): void
    {
        Schema::table('collections', function (Blueprint $table) {
            $table->dropIndex(['draft']);
            $table->dropColumn('draft');
        });
    }
};
