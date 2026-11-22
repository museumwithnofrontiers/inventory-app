<?php

namespace App\Observers;

use App\Models\User;
use App\Support\Audit\AuditLogger;
use App\Support\Authorization\AccessRevoker;
use Illuminate\Support\Carbon;

/**
 * Records every change to an account in the audit log, and cuts a disabled
 * account off: suspending a user revokes their sessions and OAuth tokens.
 * An observer, so the panel, the API, Artisan and tinker all go through it.
 */
class UserAuditObserver
{
    /**
     * Attributes worth recording, and how: the password and the 2FA secrets
     * are never written to the log, only that they changed.
     */
    private const TRACKED = ['name', 'email', 'email_verified_at', 'approved_at', 'suspended_at'];

    public function __construct(
        private readonly AuditLogger $logger,
        private readonly AccessRevoker $revoker,
    ) {}

    public function created(User $user): void
    {
        $this->logger->record('user.created', $user, [
            'name' => $user->name,
            'email' => $user->email,
            'approved' => $user->approved_at !== null,
        ]);
    }

    public function updated(User $user): void
    {
        $changes = [];

        foreach (self::TRACKED as $attribute) {
            if ($user->wasChanged($attribute)) {
                $changes[$attribute] = [
                    'from' => $this->scalar($user->getOriginal($attribute)),
                    'to' => $this->scalar($user->getAttribute($attribute)),
                ];
            }
        }

        if ($user->wasChanged('password')) {
            $changes['password'] = 'changed';
        }

        if ($user->wasChanged('two_factor_confirmed_at') || $user->wasChanged('two_factor_secret')) {
            $before = $user->getOriginal('two_factor_confirmed_at') !== null;
            $after = $user->two_factor_confirmed_at !== null && $user->two_factor_secret !== null;

            if ($before !== $after) {
                $changes['two_factor'] = ['from' => $before ? 'enabled' : 'disabled', 'to' => $after ? 'enabled' : 'disabled'];
            }
        }

        if ($changes === []) {
            return;
        }

        $this->logger->record($this->action($changes), $user, $changes);

        if ($user->wasChanged('suspended_at') && $user->suspended_at !== null) {
            $revoked = $this->revoker->revoke($user);
            $this->logger->record('user.access_revoked', $user, $revoked);
        }
    }

    public function deleting(User $user): void
    {
        $revoked = $this->revoker->revoke($user);

        if (array_sum($revoked) > 0) {
            $this->logger->record('user.access_revoked', $user, $revoked);
        }
    }

    public function deleted(User $user): void
    {
        $this->logger->record('user.deleted', $user, [
            'name' => $user->name,
            'email' => $user->email,
        ]);
    }

    /**
     * @param  array<string, mixed>  $changes
     */
    private function action(array $changes): string
    {
        return match (true) {
            isset($changes['suspended_at']) => $changes['suspended_at']['to'] === null ? 'user.reactivated' : 'user.suspended',
            isset($changes['approved_at']) && $changes['approved_at']['to'] !== null => 'user.approved',
            isset($changes['two_factor']) && $changes['two_factor']['to'] === 'disabled' => 'user.two_factor_disabled',
            default => 'user.updated',
        };
    }

    private function scalar(mixed $value): string|int|bool|null
    {
        return match (true) {
            $value instanceof Carbon => $value->toIso8601String(),
            $value instanceof \DateTimeInterface => $value->format(DATE_ATOM),
            is_string($value), is_int($value), is_bool($value), $value === null => $value,
            default => is_scalar($value) ? (string) $value : null,
        };
    }
}
