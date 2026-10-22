<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Symfony\Component\Console\Formatter\OutputFormatterStyle;
use Symfony\Component\Console\Output\ConsoleOutput;

/**
 * Seeder for creating a default user in the database.
 * This wil and shall only run in local environments.
 */
class LocalUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (! app()->isLocal()) {
            return;
        }

        // Create default user with "Regular User"
        $defaultUserPassword = config('app.default_user.password', 'password');
        $defaultUser = User::factory()->create([
            'name' => config('app.default_user.name', 'user'),
            'email' => config('app.default_user.email', 'user@example.com'),
            'password' => bcrypt($defaultUserPassword),
        ]);
        $defaultUser->save();
        $defaultUser->markEmailAsVerified();
        $defaultUser->assignRole('Regular User');

        $consoleOutput = new ConsoleOutput;
        $consoleOutput->getFormatter()->setStyle('yellow', new OutputFormatterStyle('yellow', null, ['bold']));
        $consoleOutput->getFormatter()->setStyle('green', new OutputFormatterStyle('green', null, ['bold']));
        $consoleOutput->writeln("\tThe application is running in LOCAL mode (<yellow>this is not suitable for production use</yellow>)!");
        $consoleOutput->writeln("\tTest user created: <yellow>'{$defaultUser->name}' (e-mail: '{$defaultUser->email}')</yellow>; password: <green>{$defaultUserPassword}</green>");

        // Create default admin user with "Administrator" role
        $defaultAdminPassword = config('app.default_admin.password', 'password');
        $defaultAdmin = User::factory()->create([
            'name' => config('app.default_admin.name', 'admin'),
            'email' => config('app.default_admin.email', 'admin@example.com'),
            'password' => bcrypt($defaultAdminPassword),
        ]);
        $defaultAdmin->save();
        $defaultAdmin->markEmailAsVerified();
        $defaultAdmin->assignRole('Manager of Users');

        $consoleOutput = new ConsoleOutput;
        $consoleOutput->getFormatter()->setStyle('yellow', new OutputFormatterStyle('yellow', null, ['bold']));
        $consoleOutput->getFormatter()->setStyle('green', new OutputFormatterStyle('green', null, ['bold']));
        $consoleOutput->writeln("\tAdmin user created: <yellow>'{$defaultAdmin->name}' (e-mail: '{$defaultAdmin->email}')</yellow>; password: <green>{$defaultAdminPassword}</green>");

    }
}
