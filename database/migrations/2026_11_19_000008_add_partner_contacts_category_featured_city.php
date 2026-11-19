<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 D2 (#2646, decision 7): the partner fields that were in
 * `partner_translations.extra`.
 *
 * - `partners.category`: legacy's partner category (Sharing History), one of
 *   six values; NULL elsewhere.
 * - `partners.featured`: the Portal's own selection (legacy `portal_display`
 *   = y), independent of `visible`.
 * - `partners.city`: the city as the Sharing History partner list prints it,
 *   one value for every language, as written.
 * - `partner_translations.also_known_as`: the partner's other name, per
 *   language, as written (legacy `museumnames.ex_name`).
 * - `partner_contacts`: the partner's contact persons (legacy contact person
 *   1 and 2), in legacy's order, every field as written.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('partners', function (Blueprint $table) {
            $table->string('category', 32)->nullable()->after('type');
            $table->boolean('featured')->default(false)->after('visible');
            $table->string('city')->nullable()->after('country_id');
        });

        Schema::table('partner_translations', function (Blueprint $table) {
            $table->text('also_known_as')->nullable()->after('name');
        });

        Schema::create('partner_contacts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('partner_id');
            $table->integer('display_order');
            $table->text('name')->nullable();
            $table->text('title')->nullable();
            $table->text('email')->nullable();
            $table->text('phone')->nullable();
            $table->text('fax')->nullable();
            $table->string('backward_compatibility')->nullable();
            $table->timestamps();

            $table->foreign('partner_id')->references('id')->on('partners')->cascadeOnDelete();
            $table->unique(['partner_id', 'display_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('partner_contacts');

        Schema::table('partner_translations', function (Blueprint $table) {
            $table->dropColumn('also_known_as');
        });

        Schema::table('partners', function (Blueprint $table) {
            $table->dropColumn(['category', 'featured', 'city']);
        });
    }
};
