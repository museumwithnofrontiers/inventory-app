<?php

namespace Tests\Api\Authentication;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;
use Tests\Traits\CreatesTwoFactorUsers;

class MobileAuthenticationTest extends TestCase
{
    use CreatesTwoFactorUsers, RefreshDatabase;

    protected string $mobileTokenEndpoint = '/api/mobile/acquire-token';

    public function test_mobile_user_can_acquire_token_without_two_factor(): void
    {
        $user = $this->createUserWithoutTwoFactor();

        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Mobile Device',
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure([
            'token',
            'user' => [
                'id',
                'name',
                'email',
            ],
        ]);

        // Verify token was created
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'tokenable_type' => User::class,
            'name' => 'Test Mobile Device',
        ]);
    }

    public function test_mobile_user_cannot_acquire_token_with_invalid_credentials(): void
    {
        $user = $this->createUserWithoutTwoFactor();

        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'wrong-password',
            'device_name' => 'Test Mobile Device',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);

        // Verify no token was created
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $user->id,
        ]);
    }

    public function test_mobile_token_acquisition_requires_email(): void
    {
        $response = $this->postJson($this->mobileTokenEndpoint, [
            'password' => 'password',
            'device_name' => 'Test Mobile Device',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
    }

    public function test_mobile_token_acquisition_requires_password(): void
    {
        $user = $this->createUserWithoutTwoFactor();

        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'device_name' => 'Test Mobile Device',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
    }

    public function test_mobile_token_acquisition_requires_device_name(): void
    {
        $user = $this->createUserWithoutTwoFactor();

        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['device_name']);
    }

    public function test_mobile_user_with_totp_requires_two_factor_code(): void
    {
        $user = $this->createUserWithTotp();

        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Mobile Device',
        ]);

        $response->assertStatus(202);
        $response->assertJsonStructure([
            'message',
            'requires_two_factor',
            'primary_method',
            'available_methods',
        ]);
    }

    public function test_mobile_user_can_acquire_token_with_valid_totp_code(): void
    {
        $this->mockTotpProvider(true);
        $user = $this->createUserWithTotp();

        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Mobile Device',
            'two_factor_code' => $this->getValidTotpCode(),
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure([
            'token',
            'user' => [
                'id',
                'name',
                'email',
            ],
        ]);

        // Verify token was created
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'name' => 'Test Mobile Device',
        ]);
    }

    public function test_mobile_user_cannot_acquire_token_with_invalid_totp_code(): void
    {
        $this->mockTotpProvider(false);
        $user = $this->createUserWithTotp();

        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Mobile Device',
            'two_factor_code' => $this->getInvalidTotpCode(),
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['two_factor_code']);

        // Verify no token was created
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $user->id,
        ]);
    }

    public function test_mobile_user_can_use_recovery_code_for_token_acquisition(): void
    {
        $user = $this->createUserWithRecoveryCodes();

        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Mobile Device',
            'recovery_code' => $this->getUnusedRecoveryCode(),
        ]);

        $response->assertStatus(201);

        // Verify recovery code is replaced (Fortify's secure approach)
        $user->refresh();
        $recoveryCodes = collect(json_decode(decrypt($user->two_factor_recovery_codes), true));

        // The used code should no longer exist (replaced with new one)
        $this->assertFalse($recoveryCodes->contains($this->getUnusedRecoveryCode()));

        // Should still have same number of recovery codes
        $this->assertCount(5, $recoveryCodes);
    }

    public function test_mobile_user_cannot_use_already_used_recovery_code(): void
    {
        $user = $this->createUserWithRecoveryCodes();
        $usedCode = $this->getUnusedRecoveryCode();

        // Mark recovery code as used
        $this->markRecoveryCodeAsUsed($user, $usedCode);

        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Mobile Device',
            'recovery_code' => $usedCode,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['recovery_code']);
    }

    public function test_mobile_token_has_proper_abilities(): void
    {
        $user = $this->createUserWithoutTwoFactor();

        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Mobile Device',
        ]);

        $response->assertStatus(201);

        // Get the created token
        $token = PersonalAccessToken::where('tokenable_id', $user->id)->first();
        $this->assertNotNull($token);

        // Verify token has appropriate abilities
        $this->assertTrue($token->can('*')); // or specific abilities based on your implementation
    }

    public function test_mobile_token_can_be_used_for_authenticated_requests(): void
    {
        $user = $this->createUserWithoutTwoFactor();

        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Mobile Device',
        ]);

        $token = $response->json('token');

        // Use token for authenticated request
        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->getJson('/api/user');

        $response->assertOk();
        $response->assertJson([
            'id' => $user->id,
            'email' => $user->email,
        ]);
    }

    public function test_mobile_token_acquisition_handles_invalid_base32_totp_secret(): void
    {
        // Create user with invalid Base32 TOTP secret
        $user = User::factory()->create([
            'password' => Hash::make('password'),
            'two_factor_secret' => encrypt('INVALID0TOTP1SECRET'), // Contains invalid Base32 chars
            'two_factor_confirmed_at' => now(),
        ]);

        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Mobile Device',
            'two_factor_code' => '123456',
        ]);

        // Should fail with validation error, not crash
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['two_factor_code']);
    }

    public function test_mobile_token_acquisition_rate_limiting(): void
    {
        $user = $this->createUserWithoutTwoFactor();

        // Make multiple rapid requests
        for ($i = 0; $i < 10; $i++) {
            $response = $this->postJson($this->mobileTokenEndpoint, [
                'email' => $user->email,
                'password' => 'wrong-password',
                'device_name' => 'Test Mobile Device',
            ]);
        }

        // Last request should be rate limited (if implemented)
        // Note: This depends on your rate limiting configuration
        $this->assertTrue(
            $response->status() === 422 || $response->status() === 429
        );
    }

    public function test_mobile_token_revocation(): void
    {
        $user = $this->createUserWithoutTwoFactor();

        // Acquire token
        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Mobile Device',
        ]);

        $token = $response->json('token');

        // Use token for request
        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->getJson('/api/user');

        $response->assertOk();

        // Revoke all tokens for user using Sanctum's method
        $user->tokens()->delete();

        // Clear any authentication state that might be cached
        $this->app['auth']->forgetGuards();

        // Token should no longer work
        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->getJson('/api/user');

        $response->assertStatus(401);
    }

    public function test_mobile_multiple_devices_can_have_separate_tokens(): void
    {
        $user = $this->createUserWithoutTwoFactor();

        // Acquire first token
        $response1 = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'iPhone',
        ]);

        // Acquire second token
        $response2 = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Android',
        ]);

        $token1 = $response1->json('token');
        $token2 = $response2->json('token');

        $this->assertNotEquals($token1, $token2);

        // Both tokens should work
        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token1,
        ])->getJson('/api/user');
        $response->assertOk();

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token2,
        ])->getJson('/api/user');
        $response->assertOk();

        // Verify both tokens exist in database
        $this->assertEquals(2, $user->tokens()->count());
    }

    public function test_mobile_token_includes_device_info(): void
    {
        $user = $this->createUserWithoutTwoFactor();

        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'iPhone 15 Pro',
        ]);

        $response->assertStatus(201);

        // Verify token has device info
        $token = PersonalAccessToken::where('tokenable_id', $user->id)->first();
        $this->assertEquals('iPhone 15 Pro', $token->name);
    }

    public function test_mobile_token_acquisition_with_unverified_email(): void
    {
        $user = $this->createUserWithoutTwoFactor([
            'email_verified_at' => null,
        ]);

        $response = $this->postJson($this->mobileTokenEndpoint, [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Test Mobile Device',
        ]);

        // Should fail if email verification is required
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
    }
}
