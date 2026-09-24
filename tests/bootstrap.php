<?php

/**
 * Force test environment variables before the application boots.
 *
 * Docker sets OS-level env vars (APP_ENV=local, DB_CONNECTION=mysql, etc.) that
 * survive into PHPUnit even with force="true" in phpunit.xml, because phpunit.xml
 * only sets the variables AFTER putenv has already been read by the autoloader.
 * Using putenv() here wins because this file runs before vendor/autoload.php.
 */
$testEnv = [
    'APP_ENV' => 'testing',
    'APP_URL' => 'http://localhost',
    'APP_MAINTENANCE_DRIVER' => 'file',
    'BCRYPT_ROUNDS' => '4',
    'CACHE_STORE' => 'array',
    'DB_CONNECTION' => 'sqlite',
    'DB_DATABASE' => ':memory:',
    'MAIL_MAILER' => 'array',
    'PULSE_ENABLED' => 'false',
    'QUEUE_CONNECTION' => 'sync',
    'SESSION_DRIVER' => 'array',
    'TELESCOPE_ENABLED' => 'false',
    'VITE_ENABLED' => 'false',
    // Image disks: a developer's container must not change which disks tests use
    'UPLOAD_IMAGES_DISK' => 'local',
    'UPLOAD_IMAGES_DIRECTORY' => 'image_uploads',
    'AVAILABLE_IMAGES_DISK' => 'image-originals',
    'AVAILABLE_IMAGES_DIRECTORY' => 'images',
    'PICTURES_DISK' => 'public',
    'PICTURES_DIRECTORY' => 'pictures',
];

foreach ($testEnv as $key => $value) {
    putenv("{$key}={$value}");
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
}

require_once __DIR__.'/../vendor/autoload.php';
