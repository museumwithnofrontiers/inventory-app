<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Application Name
    |--------------------------------------------------------------------------
    |
    | This value is the name of your application, which will be used when the
    | framework needs to place the application's name in a notification or
    | other UI elements where an application name needs to be displayed.
    |
    */

    'name' => env('APP_NAME', 'Laravel'),

    /*
    |--------------------------------------------------------------------------
    | Application Environment
    |--------------------------------------------------------------------------
    |
    | This value determines the "environment" your application is currently
    | running in. This may determine how you prefer to configure various
    | services the application utilizes. Set this in your ".env" file.
    |
    */

    'env' => env('APP_ENV', 'production'),

    /*
    |--------------------------------------------------------------------------
    | Application Debug Mode
    |--------------------------------------------------------------------------
    |
    | When your application is in debug mode, detailed error messages with
    | stack traces will be shown on every error that occurs within your
    | application. If disabled, a simple generic error page is shown.
    |
    */

    'debug' => (bool) env('APP_DEBUG', false),

    /*
    |--------------------------------------------------------------------------
    | Application URL
    |--------------------------------------------------------------------------
    |
    | This URL is used by the console to properly generate URLs when using
    | the Artisan command line tool. You should set this to the root of
    | the application so that it's available within Artisan commands.
    |
    */

    'url' => env('APP_URL', 'http://localhost'),

    /*
    |--------------------------------------------------------------------------
    | Application Timezone
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default timezone for your application, which
    | will be used by the PHP date and date-time functions. The timezone
    | is set to "UTC" by default as it is suitable for most use cases.
    |
    */

    'timezone' => env('APP_TIMEZONE', 'UTC'),

    /*
    |--------------------------------------------------------------------------
    | Application Locale Configuration
    |--------------------------------------------------------------------------
    |
    | The application locale determines the default locale that will be used
    | by Laravel's translation / localization methods. This option can be
    | set to any locale for which you plan to have translation strings.
    |
    */

    'locale' => env('APP_LOCALE', 'en'),

    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'en'),

    'faker_locale' => env('APP_FAKER_LOCALE', 'en_US'),

    /*
    |--------------------------------------------------------------------------
    | Encryption Key
    |--------------------------------------------------------------------------
    |
    | This key is utilized by Laravel's encryption services and should be set
    | to a random, 32 character string to ensure that all encrypted values
    | are secure. You should do this prior to deploying the application.
    |
    */

    'cipher' => 'AES-256-CBC',

    'key' => env('APP_KEY'),

    'previous_keys' => [
        ...array_filter(
            explode(',', env('APP_PREVIOUS_KEYS', ''))
        ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Maintenance Mode Driver
    |--------------------------------------------------------------------------
    |
    | These configuration options determine the driver used to determine and
    | manage Laravel's "maintenance mode" status. The "cache" driver will
    | allow maintenance mode to be controlled across multiple machines.
    |
    | Supported drivers: "file", "cache"
    |
    */

    'maintenance' => [
        'driver' => env('APP_MAINTENANCE_DRIVER', 'file'),
        'store' => env('APP_MAINTENANCE_STORE', 'database'),
    ],

    /**
     * Data for the default user of the application
     */
    'default_user' => [
        'name' => env('APP_DEFAULT_USER_USERNAME', 'user'),
        'password' => env('APP_DEFAULT_USER_PASSWORD', 'password'),
        'email' => env('APP_DEFAULT_USER_EMAIL', 'user@example.com'),
    ],
    'default_admin' => [
        'name' => env('APP_DEFAULT_ADMIN_USERNAME', 'admin'),
        'password' => env('APP_DEFAULT_ADMIN_PASSWORD', 'password'),
        'email' => env('APP_DEFAULT_ADMIN_EMAIL', 'admin@example.com'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Faker Image Provider Configuration
    |--------------------------------------------------------------------------
    |
    | This option controls whether to use local seed images or download from
    | the internet when seeding the database. Local images provide faster
    | and more reliable seeding, especially in environments with limited
    | internet connectivity.
    |
    | Default behavior:
    | - Non-production environments: Use local images (true)
    | - Production environment: Use remote images with local fallback (false)
    |
    | Set FAKER_USE_LOCAL_IMAGES=false to force remote image downloads
    | Set FAKER_USE_LOCAL_IMAGES=true to force local image usage
    |
    */

    'faker_use_local_images' => env('FAKER_USE_LOCAL_IMAGES', env('APP_ENV') !== 'production'),

    /*
    |--------------------------------------------------------------------------
    | API Documentation Access
    |--------------------------------------------------------------------------
    |
    | This option controls whether API documentation is accessible in production.
    | By default, API docs are only available in local and testing environments.
    | Set API_DOCS_ENABLED=true to enable API documentation in production.
    |
    */

    'api_docs_enabled' => env('API_DOCS_ENABLED', false),

    /*
    |--------------------------------------------------------------------------
    | Public Picture Throttle
    |--------------------------------------------------------------------------
    |
    | How many burns and errors one IP address may cause per minute on
    | /pub/{filename}, the public picture URL the data packages link to. A 304
    | or a picture served from the cache doesn't count.
    |
    */

    'pub_pictures_throttle' => (int) env('PUB_PICTURES_THROTTLE', 100),

    /*
    |--------------------------------------------------------------------------
    | Application Version
    |--------------------------------------------------------------------------
    |
    | This value may be set by the deployment pipeline (APP_VERSION) or
    | derived from a VERSION file included in the build artifacts. It is
    | optionally displayed in the web UI and returned by the /api/version
    | endpoint.
    |
    */
    'version' => env('APP_VERSION', null),
];
