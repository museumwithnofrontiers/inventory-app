<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A pending document is for an item or for a publication: item_id
     * becomes nullable beside the new publication_id (exactly one is set,
     * see DocumentUpload), with the publication document's own edition and
     * kind.
     */
    public function up(): void
    {
        Schema::table('document_uploads', function (Blueprint $table) {
            $table->uuid('item_id')->nullable()->change();
            $table->uuid('publication_id')->nullable()->after('item_id');
            $table->uuid('publication_edition_id')->nullable()->after('publication_id');
            // App\Enums\PublicationDocumentKind, for a publication document
            $table->string('kind')->nullable()->after('publication_edition_id');

            $table->foreign('publication_id')->references('id')->on('publications')->cascadeOnDelete();
            $table->foreign('publication_edition_id')->references('id')->on('publication_editions')->nullOnDelete();
            $table->index('publication_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('document_uploads', function (Blueprint $table) {
            $table->dropForeign(['publication_id']);
            $table->dropForeign(['publication_edition_id']);
            $table->dropIndex(['publication_id']);
            $table->dropColumn(['publication_id', 'publication_edition_id', 'kind']);
        });

        Schema::table('document_uploads', function (Blueprint $table) {
            $table->uuid('item_id')->nullable(false)->change();
        });
    }
};
