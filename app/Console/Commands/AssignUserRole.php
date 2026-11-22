<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\User;
use App\Support\Authorization\UserRoles;
use Illuminate\Console\Command;

class AssignUserRole extends Command
{
    /**
     * @var string
     */
    protected $signature = 'user:set-role {email : User email address} {role : Visitor, Manager of Data or Manager of Users}';

    /**
     * @var array<int, string>
     */
    protected $aliases = ['user:assign-role'];

    /**
     * @var string
     */
    protected $description = "Set a user's one role, replacing the one they hold. The superadmin role moves with user:superadmin";

    public function handle(UserRoles $roles): int
    {
        $email = (string) $this->argument('email');
        $role = Role::tryFrom((string) $this->argument('role'));

        $user = User::query()->where('email', $email)->first();

        if ($user === null) {
            $this->error("User with email '{$email}' not found.");

            return Command::FAILURE;
        }

        if ($role === null) {
            $this->error('Unknown role. Roles: '.implode(', ', array_keys(Role::options())).'.');

            return Command::FAILURE;
        }

        if ($role === Role::SUPERADMIN) {
            $this->error('The superadmin role is moved with: php artisan user:superadmin <email>');

            return Command::FAILURE;
        }

        if ($user->isSuperadmin()) {
            $this->error("'{$email}' is the superadmin. Give the role to someone else first: php artisan user:superadmin <email>");

            return Command::FAILURE;
        }

        $previous = $user->currentRole();
        $roles->assign($user, $role);

        $this->info($previous === $role
            ? "'{$email}' already holds the role '{$role->value}'."
            : "'{$email}' now holds the role '{$role->value}'".($previous !== null ? " (was '{$previous->value}')." : '.'));

        return Command::SUCCESS;
    }
}
