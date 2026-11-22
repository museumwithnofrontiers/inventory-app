<?php

namespace App\Console\Commands;

use App\Support\Authorization\RoleSync;
use Illuminate\Console\Command;
use RuntimeException;

class SyncPermissions extends Command
{
    /**
     * @var string
     */
    protected $signature = 'permissions:sync';

    /**
     * @var string
     */
    protected $description = 'Make the roles and permissions in the database match App\Enums\Role and App\Enums\Permission (idempotent; never changes who holds which role)';

    public function handle(RoleSync $sync): int
    {
        try {
            $changes = $sync->sync();
        } catch (RuntimeException $exception) {
            $this->error($exception->getMessage());

            return Command::FAILURE;
        }

        foreach ($changes as $change) {
            $this->line("  {$change}");
        }

        $this->info($changes === []
            ? 'Roles and permissions already match their definitions.'
            : 'Roles and permissions synced: '.count($changes).' change(s).');

        return Command::SUCCESS;
    }
}
