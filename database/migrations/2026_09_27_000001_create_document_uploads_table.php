<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M7 Story A4.2 (#1906). The approved migration from A4.1's design doc
 * (docs/frontend-filament/document-upload.md, "Approved migration"),
 * approved by Pascal on 2026-09-26 (#1905) — M7's only data-model change.
 *
 * `document_uploads` is a transient staging table: every row is deleted at
 * the end of one queue cycle, either promoted into an `item_documents` row
 * or rejected. See App\Models\DocumentUpload for the full rationale.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('document_uploads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('item_id');
            $table->string('language_id', 3)->nullable();
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type');
            $table->bigInteger('size');
            $table->string('title')->nullable();
            $table->integer('display_order')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign('item_id')->references('id')->on('items')->onDelete('cascade');
            $table->foreign('language_id')->references('id')->on('languages')->onDelete('set null');
            $table->index('item_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('document_uploads');
    }
};
