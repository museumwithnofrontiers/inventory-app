<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Authorization\UserRoles;
use Illuminate\Console\Command;

/**
 * The only way the superadmin role changes hands. No one can change the
 * superadmin in the panel, the other user managers included.
 */
class TransferSuperadmin extends Command
{
    /**
     * @var string
     */
    protected $signature = 'user:superadmin {email : The user who becomes the superadmin}';

    /**
     * @var string
     */
    protected $description = 'Make a user the superadmin; the previous superadmin becomes a Manager of Users';

    public function handle(UserRoles $roles): int
    {
        $email = (string) $this->argument('email');

        $user = User::query()->where('email', $email)->first();

        if ($user === null) {
            $this->error("User with email '{$email}' not found.");

            return Command::FAILURE;
        }

        if ($user->isSuperadmin()) {
            $this->info("'{$email}' already is the superadmin.");

            return Command::SUCCESS;
        }

        $previous = $roles->transferSuperadmin($user);

        $this->info("'{$email}' is now the superadmin.");

        if ($previous !== null) {
            $this->line("'{$previous->email}' is now a Manager of Users.");
        }

        return Command::SUCCESS;
    }
}
