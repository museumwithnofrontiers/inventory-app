<?php

namespace App\Support\Authorization;

use App\Enums\Role as RoleEnum;
use App\Models\User;
use App\Policies\UserPolicy;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * The one way a user's role changes. A user holds exactly one role or none,
 * and exactly one user holds the superadmin role: assign() refuses to create
 * a second one, and transferSuperadmin() moves it.
 *
 * Who may change whose role is the policy's call ({@see UserPolicy::assignRole()}),
 * not this class's: it serves the panel and Artisan alike.
 */
final class UserRoles
{
    public function assign(User $user, RoleEnum $role): void
    {
        if ($role === RoleEnum::SUPERADMIN) {
            $holder = $this->superadmin();

            if ($holder !== null && ! $holder->is($user)) {
                throw new InvalidArgumentException('Another user already holds the superadmin role. Move it with php artisan user:superadmin.');
            }
        }

        if ($user->currentRole() === $role) {
            return;
        }

        $user->syncRoles([$role->value]);
        $user->unsetRelation('roles');
    }

    public function clear(User $user): void
    {
        if ($user->roles()->doesntExist()) {
            return;
        }

        $user->syncRoles([]);
        $user->unsetRelation('roles');
    }

    /**
     * Gives the superadmin role to the user; its previous holder becomes a
     * Manager of Users.
     */
    public function transferSuperadmin(User $user): ?User
    {
        return DB::transaction(function () use ($user): ?User {
            $previous = $this->superadmin();

            if ($previous !== null && $previous->is($user)) {
                return null;
            }

            if ($previous !== null) {
                $previous->syncRoles([RoleEnum::USER_MANAGER->value]);
                $previous->unsetRelation('roles');
            }

            $user->syncRoles([RoleEnum::SUPERADMIN->value]);
            $user->unsetRelation('roles');

            return $previous;
        });
    }

    public function superadmin(): ?User
    {
        return User::query()
            ->whereHas('roles', fn ($query) => $query->where('name', RoleEnum::SUPERADMIN->value))
            ->first();
    }
}
