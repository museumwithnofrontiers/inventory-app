<?php

namespace Tests\Api\Authentication;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Tests\TestCase;

class MobileApi2faTest extends TestCase
{
    use RefreshDatabase;

    public function test_mobile_api_can_authenticate_user_without_2fa(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/mobile/acquire-token', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Device',
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure([
            'token',
            'user' => ['id', 'name', 'email', 'two_factor_enabled'],
        ]);
        $response->assertJson([
            'user' => [
                'two_factor_enabled' => false,
            ],
        ]);
    }

    public function test_mobile_api_requires_2fa_when_user_has_totp_enabled(): void
    {
        $user = User::factory()->create();

        // Enable TOTP for user
        $user->forceFill([
            'two_factor_secret' => encrypt('test-secret'),
            'two_factor_confirmed_at' => now(),
        ])->save();

        $response = $this->postJson('/api/mobile/acquire-token', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Device',
        ]);

        $response->assertStatus(202);
        $response->assertJson([
            'requires_two_factor' => true,
            'available_methods' => ['totp'],
            'primary_method' => 'totp',
        ]);
    }

    public function test_mobile_api_can_verify_totp_2fa_code(): void
    {
        $user = User::factory()->create();

        // Enable TOTP
        $user->forceFill([
            'two_factor_secret' => encrypt('test-secret'),
            'two_factor_confirmed_at' => now(),
        ])->save();

        // Mock the TOTP provider to return true
        $this->mock(TwoFactorAuthenticationProvider::class, function ($mock) {
            $mock->shouldReceive('verify')->once()->andReturn(true);
        });

        $response = $this->postJson('/api/mobile/verify-two-factor', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Device',
            'code' => '123456',
            'method' => 'totp',
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure([
            'token',
            'user' => ['id', 'name', 'email', 'two_factor_enabled', 'two_factor_method'],
        ]);
        $response->assertJson([
            'user' => [
                'two_factor_enabled' => true,
                'two_factor_method' => 'totp',
            ],
        ]);
    }

    public function test_mobile_api_rejects_invalid_totp_2fa_code(): void
    {
        $user = User::factory()->create();

        // Enable TOTP
        $user->forceFill([
            'two_factor_secret' => encrypt('test-secret'),
            'two_factor_confirmed_at' => now(),
        ])->save();

        // Mock the TOTP provider to return false
        $this->mock(TwoFactorAuthenticationProvider::class, function ($mock) {
            $mock->shouldReceive('verify')->once()->andReturn(false);
        });

        $response = $this->postJson('/api/mobile/verify-two-factor', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Device',
            'code' => '000000',
            'method' => 'totp',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['code']);
    }

    public function test_mobile_api_fails_with_invalid_credentials(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/mobile/acquire-token', [
            'email' => $user->email,
            'password' => 'wrong-password',
            'device_name' => 'Test Device',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
    }

    public function test_mobile_api_can_wipe_tokens_after_authentication(): void
    {
        $user = User::factory()->create();

        // Create some existing tokens
        $user->createToken('Old Device 1');
        $user->createToken('Old Device 2');

        $this->assertEquals(2, $user->tokens()->count());

        $response = $this->postJson('/api/mobile/acquire-token', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'New Device',
            'wipe_tokens' => true,
        ]);

        $response->assertStatus(201);

        // Should have only the new token
        $this->assertEquals(1, $user->fresh()->tokens()->count());
        $this->assertEquals('New Device', $user->fresh()->tokens()->first()->name);
    }
}
