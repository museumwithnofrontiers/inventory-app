<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;

/**
 * Writes the REST API's OpenAPI document (docs/_openapi/api.json) the same way everywhere.
 *
 * Scramble reads each model's table to type the API resources, so the document used to depend on
 * whatever database the command ran against: a table missing there turned a whole schema into
 * strings. This command migrates a throwaway SQLite file and exports against that, never against
 * the configured database, and pins the URLs the document embeds. CI runs it and fails when the
 * committed file differs.
 */
class ExportOpenApiDocument extends Command
{
    private const CONNECTION = 'openapi_export';

    /** The URL the document embeds (servers, OAuth endpoints), whatever APP_URL says. */
    private const ROOT_URL = 'http://localhost';

    /**
     * @var string
     */
    protected $signature = 'docs:openapi {--path= : Where to write the document (default: scramble.export_path)}';

    /**
     * @var string
     */
    protected $description = 'Export the REST API OpenAPI document from a freshly migrated, throwaway SQLite database';

    public function handle(): int
    {
        $database = tempnam(sys_get_temp_dir(), 'openapi-');
        if ($database === false) {
            $this->error('Cannot create the temporary database file.');

            return self::FAILURE;
        }

        $previousDefault = Config::string('database.default');

        try {
            Config::set('database.connections.'.self::CONNECTION, [
                'driver' => 'sqlite',
                'database' => $database,
                'prefix' => '',
                'foreign_key_constraints' => true,
            ]);
            Config::set('database.default', self::CONNECTION);
            Config::set('app.url', self::ROOT_URL);
            URL::forceRootUrl(self::ROOT_URL);
            URL::forceScheme('http');

            if ($this->call('migrate', ['--database' => self::CONNECTION, '--force' => true]) !== self::SUCCESS) {
                $this->error('Migrating the temporary database failed.');

                return self::FAILURE;
            }

            $path = $this->option('path');

            return $this->call('scramble:export', is_string($path) && $path !== '' ? ['--path' => $path] : []);
        } finally {
            DB::purge(self::CONNECTION);
            Config::set('database.default', $previousDefault);
            @unlink($database);
        }
    }
}
