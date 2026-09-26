<?php

namespace Tests\Filament\Concerns;

use App\Enums\Permission;
use App\Models\User;
use Filament\Facades\Filament;

/**
 * Shared Filament admin-panel test helpers.
 *
 * M7 Story A0.4: every PHPUnit class-style test under tests/Filament/ that
 * needs a panel context or a permission-scoped user pulls these from here
 * instead of carrying its own local copy.
 */
trait InteractsWithAdminPanel
{
    protected function setCurrentPanel(): void
    {
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    protected function createCrudUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
            Permission::CREATE_DATA->value,
            Permission::UPDATE_DATA->value,
            Permission::DELETE_DATA->value,
        ]);

        return $user;
    }

    protected function createReferenceDataUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::MANAGE_REFERENCE_DATA->value,
        ]);

        return $user;
    }

    protected function createViewOnlyUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
        ]);

        return $user;
    }
}
