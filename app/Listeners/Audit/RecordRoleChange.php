<?php

namespace App\Listeners\Audit;

use App\Models\User;
use App\Support\Audit\AuditLogger;
use Illuminate\Support\Collection;
use Spatie\Permission\Events\RoleAttachedEvent;
use Spatie\Permission\Events\RoleDetachedEvent;
use Spatie\Permission\Models\Role;

/**
 * Records every role given to or taken from a user, whichever way it was
 * done (panel, user:set-role, user:superadmin, a migration, tinker).
 */
class RecordRoleChange
{
    public function __construct(private readonly AuditLogger $logger) {}

    public function handle(RoleAttachedEvent|RoleDetachedEvent $event): void
    {
        if (! $event->model instanceof User) {
            return;
        }

        $names = $this->roleNames($event->rolesOrIds);

        if ($names === []) {
            return;
        }

        $this->logger->record(
            $event instanceof RoleAttachedEvent ? 'user.role_added' : 'user.role_removed',
            $event->model,
            ['roles' => $names],
        );
    }

    /**
     * @return array<int, string>
     */
    private function roleNames(mixed $rolesOrIds): array
    {
        $items = match (true) {
            $rolesOrIds instanceof Collection => $rolesOrIds->all(),
            is_array($rolesOrIds) => $rolesOrIds,
            default => [$rolesOrIds],
        };

        $names = [];
        $ids = [];

        foreach ($items as $item) {
            if ($item instanceof Role) {
                $names[] = (string) $item->getAttribute('name');
            } elseif (is_int($item) || is_string($item)) {
                $ids[] = $item;
            }
        }

        if ($ids !== []) {
            foreach (Role::query()->whereIn('id', $ids)->pluck('name') as $name) {
                $names[] = (string) $name;
            }
        }

        sort($names);

        return array_values(array_unique($names));
    }
}
