<?php

use App\Enums\Permission as PermissionEnum;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * The inventory MCP server's permission, granted to every role that may
 * enter the panel. A migration rather than only the seeders because deploys
 * run migrations, not permissions:sync.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasTable('roles')) {
            return;
        }

        $permission = Permission::firstOrCreate(
            ['name' => PermissionEnum::ACCESS_MCP->value, 'guard_name' => 'web'],
            ['description' => 'Browse the inventory through its read-only MCP server'],
        );

        Role::query()
            ->whereHas('permissions', fn (Builder $query) => $query->where('name', PermissionEnum::ACCESS_ADMIN_PANEL->value))
            ->get()
            ->each(fn (Role $role) => $role->givePermissionTo($permission));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        Permission::query()->where('name', PermissionEnum::ACCESS_MCP->value)->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
