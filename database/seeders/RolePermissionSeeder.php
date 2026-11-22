<?php

namespace Database\Seeders;

use App\Support\Authorization\RoleSync;
use Illuminate\Database\Seeder;

/**
 * The roles and permissions, from their only definition (App\Enums\Role and
 * App\Enums\Permission, through RoleSync).
 */
class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(RoleSync::class)->sync();

        $this->command?->info('Roles and permissions match App\Enums\Role and App\Enums\Permission.');
    }
}
