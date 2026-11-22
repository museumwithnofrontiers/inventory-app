<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Authorization\UserRoles;
use Illuminate\Console\Command;

class RemoveUserRole extends Command
{
    /**
     * @var string
     */
    protected $signature = 'user:remove-role {email : User email address}';

    /**
     * @var string
     */
    protected $description = "Take a user's role away: with no role, the account has no access at all";

    public function handle(UserRoles $roles): int
    {
        $email = (string) $this->argument('email');

        $user = User::query()->where('email', $email)->first();

        if ($user === null) {
            $this->error("User with email '{$email}' not found.");

            return Command::FAILURE;
        }

        if ($user->isSuperadmin()) {
            $this->error("'{$email}' is the superadmin. Give the role to someone else first: php artisan user:superadmin <email>");

            return Command::FAILURE;
        }

        $previous = $user->currentRole();

        if ($previous === null) {
            $this->info("'{$email}' holds no role.");

            return Command::SUCCESS;
        }

        $roles->clear($user);

        $this->info("'{$email}' no longer holds the role '{$previous->value}'.");

        return Command::SUCCESS;
    }
}
