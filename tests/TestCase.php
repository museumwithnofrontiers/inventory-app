<?php

namespace Tests;

use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

abstract class TestCase extends BaseTestCase
{
    protected bool $seed = true;

    protected string $seeder = RolePermissionSeeder::class;

    protected function setUp(): void
    {
        parent::setUp();

        // The originals disk is a real local directory: AvailableImageFactory and
        // every attach write there, so a test that forgets to fake it would leave
        // files behind in the developer's storage.
        Storage::fake(Config::string('localstorage.available.images.disk'));
    }
}
