<?php

namespace Database\Seeders;

use App\Enums\Permission as PermissionEnum;
use App\Models\Country;
use App\Models\Language;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class ProductionDataSeeder extends Seeder
{
    /**
     * Run the database seeds for production.
     *
     * This seeder imports the full dataset of countries, languages,
     * and creates essential roles and permissions.
     */
    public function run(): void
    {
        $this->setupRolesAndPermissions();
        $this->importCountries();
        $this->importLanguages();
    }

    /**
     * Setup essential roles and permissions.
     */
    protected function setupRolesAndPermissions(): void
    {
        // Reset cached roles and permissions
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Create permissions
        $permissions = [
            // Data operation permissions
            PermissionEnum::VIEW_DATA->value => 'Read access to all data models',
            PermissionEnum::CREATE_DATA->value => 'Create new records in data models',
            PermissionEnum::UPDATE_DATA->value => 'Modify existing records',
            PermissionEnum::DELETE_DATA->value => 'Remove records from data models',

            // User management permissions
            PermissionEnum::MANAGE_USERS->value => 'Create, read, update, delete users',
            PermissionEnum::ASSIGN_ROLES->value => 'Grant and revoke user roles',
            PermissionEnum::VIEW_USER_MANAGEMENT->value => 'Access user management interfaces',

            // Role management permissions
            PermissionEnum::MANAGE_ROLES->value => 'Create, read, update roles and permissions',
            PermissionEnum::VIEW_ROLE_MANAGEMENT->value => 'Access role management interfaces',

            // System settings permissions
            PermissionEnum::MANAGE_SETTINGS->value => 'Manage system settings and configuration',
            PermissionEnum::MANAGE_REFERENCE_DATA->value => 'Manage reference-data resources in the Filament administration panel',
            PermissionEnum::ACCESS_ADMIN_PANEL->value => 'Access the Filament administration panel',
            PermissionEnum::ACCESS_MCP->value => 'Browse the inventory through its read-only MCP server',
        ];

        foreach ($permissions as $name => $description) {
            Permission::firstOrCreate(
                ['name' => $name],
                ['description' => $description]
            );
        }

        // Create "Non-verified users" role with no permissions
        $nonVerifiedRole = Role::firstOrCreate(
            ['name' => 'Non-verified users'],
            ['description' => 'Self-registered users awaiting verification by administrators']
        );

        // Non-verified users get no permissions - they cannot do anything until verified
        $nonVerifiedRole->syncPermissions([]);

        // Create "Visitor" role with read-only data access
        $visitorRole = Role::firstOrCreate(
            ['name' => 'Visitor'],
            ['description' => 'Read-only access to data (list and show operations only)']
        );

        $visitorRole->syncPermissions([
            PermissionEnum::VIEW_DATA->value,
        ]);

        // Create "Regular User" role with data operation permissions
        $regularUserRole = Role::firstOrCreate(
            ['name' => 'Regular User'],
            ['description' => 'Standard user with data operation access']
        );

        $regularUserRole->syncPermissions([
            PermissionEnum::VIEW_DATA->value,
            PermissionEnum::CREATE_DATA->value,
            PermissionEnum::UPDATE_DATA->value,
            PermissionEnum::DELETE_DATA->value,
            PermissionEnum::ACCESS_ADMIN_PANEL->value,
            PermissionEnum::ACCESS_MCP->value,
            PermissionEnum::MANAGE_REFERENCE_DATA->value,
        ]);

        // Create "Manager of Users" role with only user/role management permissions
        $managerRole = Role::firstOrCreate(
            ['name' => 'Manager of Users'],
            ['description' => 'User and role management access only (no data operations)']
        );

        $managerRole->syncPermissions([
            // User management permissions
            PermissionEnum::MANAGE_USERS->value,
            PermissionEnum::ASSIGN_ROLES->value,
            PermissionEnum::VIEW_USER_MANAGEMENT->value,

            // Role management permissions
            PermissionEnum::MANAGE_ROLES->value,
            PermissionEnum::VIEW_ROLE_MANAGEMENT->value,

            // System settings permissions
            PermissionEnum::MANAGE_SETTINGS->value,
            PermissionEnum::ACCESS_ADMIN_PANEL->value,
            PermissionEnum::ACCESS_MCP->value,
        ]);

        $this->command->info('Roles and permissions setup completed!');
        $this->command->info('Roles: Non-verified users, Visitor, Regular User, Manager of Users');
        $this->command->info('Permissions: '.count($permissions).' created/verified');
    }

    /**
     * Import countries from production data file.
     */
    protected function importCountries(): void
    {
        $countriesPath = database_path('seeders/data/countries.json');

        if (! File::exists($countriesPath)) {
            $this->command->error('Countries data file not found.');

            return;
        }

        $countries = json_decode(File::get($countriesPath), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->command->error('Invalid JSON in countries data file.');

            return;
        }

        foreach ($countries as $country) {
            Country::updateOrCreate(
                ['id' => $country['id']],
                $country
            );
        }

        $this->command->info('Imported '.count($countries).' countries.');
    }

    /**
     * Import languages from production data file.
     */
    protected function importLanguages(): void
    {
        $languagesPath = database_path('seeders/data/languages.json');

        if (! File::exists($languagesPath)) {
            $this->command->error('Languages data file not found.');

            return;
        }

        $languages = json_decode(File::get($languagesPath), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->command->error('Invalid JSON in languages data file.');

            return;
        }

        foreach ($languages as $language) {
            Language::updateOrCreate(
                ['id' => $language['id']],
                $language
            );
        }

        $this->command->info('Imported '.count($languages).' languages.');

        // Ensure exactly one language is marked as default
        $this->ensureSingleDefaultLanguage();
    }

    /**
     * Ensure exactly one language is marked as default.
     */
    protected function ensureSingleDefaultLanguage(): void
    {
        $defaultLanguages = Language::where('is_default', true)->get();

        if ($defaultLanguages->count() === 1) {
            $this->command->info('Default language is properly set.');

            return;
        }

        if ($defaultLanguages->count() === 0) {
            // No default language, set English as default
            $english = Language::find('eng');
            if ($english) {
                $english->setDefault();
                $this->command->info('Set English as default language.');
            } else {
                $this->command->warn('English language not found, no default language set.');
            }
        } else {
            // Multiple default languages, keep only English
            Language::query()->update(['is_default' => false]);
            $english = Language::find('eng');
            if ($english) {
                $english->update(['is_default' => true]);
                $this->command->info('Reset default language to English only.');
            }
        }
    }
}
