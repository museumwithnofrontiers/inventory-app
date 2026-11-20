<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M16 J2 (#2709): the partner a project partner belongs to.
 *
 * Legacy nests associated (and further associated) museums and institutions
 * under a tier-1 partner of the same project (`associated_museums.partner_id`
 * and the like). The importer kept that in one `partner_group:*` collection
 * per tier-1 partner; it now goes on the member's own project-tier row, and
 * the group collections are no longer created.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('collection_partner', function (Blueprint $table) {
            $table->foreignUuid('parent_partner_id')
                ->nullable()
                ->after('visible')
                ->constrained('partners')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('collection_partner', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_partner_id');
        });
    }
};
