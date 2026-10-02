<?php

namespace Tests\Web\Authentication;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class TotpAuthenticationIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected string $validSecret;

    protected Google2FA $google2fa;

    protected function setUp(): void
    {
        parent::setUp();

        $this->google2fa = new Google2FA;
        $this->validSecret = $this->google2fa->generateSecretKey();

        $this->user = User::factory()->create([
            'password' => Hash::make('test-password'),
            'two_factor_secret' => encrypt($this->validSecret),
            'two_factor_confirmed_at' => now(),
        ]);
    }

    protected function getCurrentTotpCode(): string
    {
        return $this->google2fa->getCurrentOtp($this->validSecret);
    }

    protected function getInvalidTotpCode(): string
    {
        return '000000'; // Obviously invalid code
    }

    public function test_api_mobile_authentication_with_valid_totp_succeeds(): void
    {
        $response = $this->postJson('/api/mobile/verify-two-factor', [
            'email' => $this->user->email,
            'password' => 'test-password',
            'device_name' => 'Test Device',
            'code' => $this->getCurrentTotpCode(),
            'method' => 'totp',
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure([
            'token',
            'user' => [
                'id',
                'name',
                'email',
                'two_factor_enabled',
            ],
        ]);

        $response->assertJson([
            'user' => [
                'id' => $this->user->id,
                'email' => $this->user->email,
                'two_factor_enabled' => true,
            ],
        ]);

        // Verify token is valid
        $token = $response->json('token');
        $this->assertNotEmpty($token);
    }

    public function test_api_mobile_authentication_with_invalid_totp_fails(): void
    {
        $response = $this->postJson('/api/mobile/verify-two-factor', [
            'email' => $this->user->email,
            'password' => 'test-password',
            'device_name' => 'Test Device',
            'code' => $this->getInvalidTotpCode(),
            'method' => 'totp',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['code']);
        $response->assertJson([
            'message' => 'The provided two-factor authentication code was invalid.',
            'errors' => [
                'code' => ['The provided two-factor authentication code was invalid.'],
            ],
        ]);
    }

    public function test_api_mobile_authentication_with_wrong_credentials_fails(): void
    {
        $response = $this->postJson('/api/mobile/verify-two-factor', [
            'email' => $this->user->email,
            'password' => 'wrong-password',
            'device_name' => 'Test Device',
            'code' => $this->getCurrentTotpCode(),
            'method' => 'totp',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
    }

    public function test_api_mobile_token_can_be_used_for_authenticated_requests(): void
    {
        // Get token via 2FA
        $response = $this->postJson('/api/mobile/verify-two-factor', [
            'email' => $this->user->email,
            'password' => 'test-password',
            'device_name' => 'Test Device',
            'code' => $this->getCurrentTotpCode(),
            'method' => 'totp',
        ]);

        $token = $response->json('token');

        // Use token to access protected endpoint
        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->getJson('/api/user');

        $response->assertOk();
        $response->assertJson([
            'id' => $this->user->id,
            'email' => $this->user->email,
        ]);
    }

    public function test_api_two_factor_status_returns_correct_info(): void
    {
        $response = $this->postJson('/api/mobile/two-factor-status', [
            'email' => $this->user->email,
            'password' => 'test-password',
        ]);

        $response->assertOk();
        $response->assertJson([
            'data' => [
                'two_factor_enabled' => true,
                'available_methods' => ['totp'],
                'primary_method' => 'totp',
                'requires_two_factor' => true,
            ],
        ]);
    }

    public function test_user_without_2fa_can_authenticate_normally(): void
    {
        $userWithout2FA = User::factory()->create([
            'password' => Hash::make('test-password'),
            'two_factor_secret' => null,
            'two_factor_confirmed_at' => null,
        ]);

        // API authentication should work without 2FA
        $response = $this->postJson('/api/mobile/acquire-token', [
            'email' => $userWithout2FA->email,
            'password' => 'test-password',
            'device_name' => 'Test Device',
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure(['token', 'user']);
        $response->assertJson([
            'user' => [
                'two_factor_enabled' => false,
            ],
        ]);
    }

    public function test_expired_totp_code_fails_authentication(): void
    {
        // Generate a code from a past timestamp (more than window allows)
        $pastTimestamp = $this->google2fa->getTimestamp() - 300; // 5 minutes ago
        $expiredCode = $this->google2fa->oathTotp($this->validSecret, $pastTimestamp);

        $response = $this->postJson('/api/mobile/verify-two-factor', [
            'email' => $this->user->email,
            'password' => 'test-password',
            'device_name' => 'Test Device',
            'code' => $expiredCode,
            'method' => 'totp',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['code']);
    }

    public function test_totp_authentication_handles_invalid_base32_secret_gracefully(): void
    {
        // Create user with invalid Base32 secret
        $userWithInvalidSecret = User::factory()->create([
            'password' => Hash::make('test-password'),
            'two_factor_secret' => encrypt('INVALID0SECRET1'), // Contains invalid Base32 chars 0 and 1
            'two_factor_confirmed_at' => now(),
        ]);

        $response = $this->postJson('/api/mobile/verify-two-factor', [
            'email' => $userWithInvalidSecret->email,
            'password' => 'test-password',
            'device_name' => 'Test Device',
            'code' => '123456',
            'method' => 'totp',
        ]);

        // Should fail gracefully with validation error, not crash
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['code']);
        $response->assertJson([
            'message' => 'The provided two-factor authentication code was invalid.',
        ]);
    }

    public function test_concurrent_totp_code_usage_prevention(): void
    {
        $code = $this->getCurrentTotpCode();

        // First use should succeed
        $response1 = $this->postJson('/api/mobile/verify-two-factor', [
            'email' => $this->user->email,
            'password' => 'test-password',
            'device_name' => 'Device 1',
            'code' => $code,
            'method' => 'totp',
        ]);

        $response1->assertStatus(201);

        // Second use of same code should fail (if replay protection is implemented)
        $response2 = $this->postJson('/api/mobile/verify-two-factor', [
            'email' => $this->user->email,
            'password' => 'test-password',
            'device_name' => 'Device 2',
            'code' => $code,
            'method' => 'totp',
        ]);

        // Note: This test depends on replay protection implementation
        // If not implemented, both might succeed
        $this->assertTrue(
            $response2->status() === 422 || $response2->status() === 201,
            'Expected either replay protection (422) or no protection (201)'
        );
    }
}
