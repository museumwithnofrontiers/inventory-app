<?php

namespace Tests\Configuration;

use Tests\TestCase;

class PubPicturesThrottleConfigurationTest extends TestCase
{
    public function test_the_throttle_defaults_to_sixty(): void
    {
        $this->assertSame(60, $this->appConfigWith(null)['pub_pictures_throttle']);
    }

    /**
     * The limiter reads app.pub_pictures_throttle, so the variable only
     * counts if config/app.php maps it there (it once named a key nothing
     * defined, and the limit could not be changed).
     */
    public function test_the_throttle_is_read_from_the_environment(): void
    {
        $this->assertSame(7, $this->appConfigWith('7')['pub_pictures_throttle']);
    }

    /**
     * config/app.php as it reads with PUB_PICTURES_THROTTLE set to $value,
     * or unset when null.
     *
     * @return array<string, mixed>
     */
    private function appConfigWith(?string $value): array
    {
        $saved = [$_SERVER['PUB_PICTURES_THROTTLE'] ?? null, $_ENV['PUB_PICTURES_THROTTLE'] ?? null, getenv('PUB_PICTURES_THROTTLE')];

        try {
            if ($value === null) {
                unset($_SERVER['PUB_PICTURES_THROTTLE'], $_ENV['PUB_PICTURES_THROTTLE']);
                putenv('PUB_PICTURES_THROTTLE');
            } else {
                $_SERVER['PUB_PICTURES_THROTTLE'] = $_ENV['PUB_PICTURES_THROTTLE'] = $value;
                putenv('PUB_PICTURES_THROTTLE='.$value);
            }

            return require config_path('app.php');
        } finally {
            [$server, $env, $getenv] = $saved;
            if ($server === null) {
                unset($_SERVER['PUB_PICTURES_THROTTLE']);
            } else {
                $_SERVER['PUB_PICTURES_THROTTLE'] = $server;
            }
            if ($env === null) {
                unset($_ENV['PUB_PICTURES_THROTTLE']);
            } else {
                $_ENV['PUB_PICTURES_THROTTLE'] = $env;
            }
            putenv($getenv === false ? 'PUB_PICTURES_THROTTLE' : 'PUB_PICTURES_THROTTLE='.$getenv);
        }
    }
}
