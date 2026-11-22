<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Spatie\Permission\Models\Role;

class ShowUser extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:show {email : User email address}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Show detailed information about a user';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = $this->argument('email');

        $user = User::with('roles.permissions')->where('email', $email)->first();
        if (! $user) {
            $this->error("User with email '{$email}' not found.");

            return Command::FAILURE;
        }

        $this->info('User Information:');
        $this->line("ID: {$user->id}");
        $this->line("Name: {$user->name}");
        $this->line("Email: {$user->email}");
        $this->line("Created: {$user->created_at?->format('Y-m-d H:i:s')}");
        $this->line("Updated: {$user->updated_at?->format('Y-m-d H:i:s')}");

        $this->newLine();

        if ($user->roles->isEmpty()) {
            $this->error('⚠️  This user has no roles assigned!');
            $this->line("Use 'php artisan user:set-role {$email} \"Role Name\"' to give them a role.");
        } else {
            $this->info('Assigned Roles:');
            foreach ($user->roles as $role) {
                /** @var Role $role */
                $this->line("  • {$role->name}");
            }

            $this->newLine();
            $this->info('Permissions (via roles):');
            $permissions = $user->getAllPermissions()->pluck('name')->unique()->sort();
            foreach ($permissions as $permission) {
                $this->line('  • '.(is_string($permission) ? $permission : ''));
            }
        }

        return Command::SUCCESS;
    }
}
