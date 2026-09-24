<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The partner's fax number, carried like contact_phone: a property of
     * the partner the importer copies onto each language row.
     */
    public function up(): void
    {
        Schema::table('partner_translations', function (Blueprint $table) {
            $table->string('contact_fax')->nullable()->after('contact_phone');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('partner_translations', function (Blueprint $table) {
            $table->dropColumn('contact_fax');
        });
    }
};
