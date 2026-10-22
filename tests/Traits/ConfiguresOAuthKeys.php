<?php

namespace Tests\Traits;

use Illuminate\Support\Facades\Config;
use RuntimeException;

/**
 * Gives the OAuth server (Passport) a signing key pair. The pair lives in
 * config, never in storage/, so a test never reads or overwrites a
 * developer's keys. Generating RSA keys is slow, so one pair serves the
 * whole process.
 *
 * The base TestCase calls configureOAuthKeys() for every test.
 */
trait ConfiguresOAuthKeys
{
    /** @var array{private: string, public: string}|null */
    private static ?array $oauthKeyPair = null;

    protected function configureOAuthKeys(): void
    {
        self::$oauthKeyPair ??= self::generateOAuthKeyPair();

        Config::set('passport.private_key', self::$oauthKeyPair['private']);
        Config::set('passport.public_key', self::$oauthKeyPair['public']);
    }

    /**
     * @return array{private: string, public: string}
     */
    private static function generateOAuthKeyPair(): array
    {
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);

        if ($key === false || ! openssl_pkey_export($key, $private)) {
            throw new RuntimeException('Could not generate an RSA key pair for the OAuth tests.');
        }

        $details = openssl_pkey_get_details($key);

        if ($details === false || ! is_string($private)) {
            throw new RuntimeException('Could not read the generated RSA key pair.');
        }

        /** @var string $public */
        $public = $details['key'];

        return ['private' => $private, 'public' => $public];
    }
}
