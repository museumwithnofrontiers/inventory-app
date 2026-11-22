<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The audit log of account changes: users, their role, suspensions, 2FA
 * resets, revoked sessions and tokens, and the account and permission
 * commands run with Artisan. User managers read it in the panel; nobody can
 * change or delete an entry (App\Models\AuditLog refuses both).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->timestamp('occurred_at')->index();
            // Who acted: a signed-in user, or the server account for Artisan
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_label');
            // panel, api, mcp, console
            $table->string('channel', 16)->index();
            $table->string('action', 64)->index();
            $table->string('subject_type')->nullable();
            $table->string('subject_id')->nullable();
            // Kept as written at the time, so the entry survives the subject's deletion
            $table->string('subject_label')->nullable();
            $table->json('changes')->nullable();
            $table->string('ip_address', 45)->nullable();

            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
