<?php

namespace Tests;

use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Tests\Traits\ConfiguresOAuthKeys;

abstract class TestCase extends BaseTestCase
{
    use ConfiguresOAuthKeys;

    protected bool $seed = true;

    protected string $seeder = RolePermissionSeeder::class;

    protected function setUp(): void
    {
        parent::setUp();

        // Every API route authenticates on the OAuth guard, which needs the
        // server's key pair as soon as it is resolved.
        $this->configureOAuthKeys();

        // The originals disk is a real local directory: AvailableImageFactory and
        // every attach write there, so a test that forgets to fake it would leave
        // files behind in the developer's storage.
        Storage::fake(Config::string('localstorage.available.images.disk'));
    }
}
