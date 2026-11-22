<?php

namespace App\Support\Audit;

use App\Listeners\Audit\RecordConsoleCommand;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

/**
 * Writes the audit log. Every account change reaches it, whichever way it
 * was made: the User observer and the role events record panel, API and
 * Artisan changes alike, and every account or permission command run with
 * Artisan is recorded too ({@see RecordConsoleCommand}).
 */
final class AuditLogger
{
    /**
     * @param  array<string, mixed>  $changes
     */
    public function record(string $action, ?Model $subject = null, array $changes = [], ?string $subjectLabel = null): AuditLog
    {
        $actor = Auth::user();
        $actorUser = $actor instanceof User ? $actor : null;

        return AuditLog::query()->create([
            'occurred_at' => now(),
            'actor_id' => $actorUser?->getKey(),
            'actor_label' => $actorUser !== null ? $actorUser->email : $this->consoleActor(),
            'channel' => $this->channel($actorUser),
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject !== null ? (string) $subject->getKey() : null,
            'subject_label' => $subjectLabel ?? $this->label($subject),
            'changes' => $changes === [] ? null : $changes,
            'ip_address' => $actorUser !== null ? Request::ip() : null,
        ]);
    }

    private function channel(?User $actor): string
    {
        if ($actor === null) {
            return app()->runningInConsole() ? 'console' : 'system';
        }

        if (Request::is('api/*')) {
            return 'api';
        }

        if (Request::is('mcp/*')) {
            return 'mcp';
        }

        return 'panel';
    }

    /**
     * The server account and host that ran the command: Artisan has no
     * signed-in user, and whoever can reach the server can run it.
     */
    private function consoleActor(): string
    {
        $account = null;

        if (function_exists('posix_geteuid') && function_exists('posix_getpwuid')) {
            $entry = posix_getpwuid(posix_geteuid());
            $account = is_array($entry) ? $entry['name'] : null;
        }

        $account ??= getenv('USER') ?: (getenv('USERNAME') ?: get_current_user());
        $host = gethostname() ?: 'unknown-host';

        return app()->runningInConsole()
            ? "console: {$account}@{$host}"
            : "system: {$account}@{$host}";
    }

    private function label(?Model $subject): ?string
    {
        if ($subject === null) {
            return null;
        }

        if ($subject instanceof User) {
            return $subject->email;
        }

        $name = $subject->getAttribute('name');

        return is_string($name) ? $name : (string) $subject->getKey();
    }
}
