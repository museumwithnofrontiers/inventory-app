<?php

namespace Tests\Api\User;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Passport\Passport;
use Tests\TestCase;

class CurrentUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_returns_the_signed_in_user(): void
    {
        $user = User::factory()->create();

        $this->signedInWithToken($user)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('id', $user->id)
            ->assertJsonPath('email', $user->email);
    }

    public function test_it_no_longer_carries_a_profile_photo_url(): void
    {
        // A generated avatar link, dropped with the package that appended it (M8)
        $this->signedInWithToken(User::factory()->create())
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonMissingPath('profile_photo_url');
    }

    public function test_a_guest_gets_unauthorized(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }

    /**
     * A token of the user's, as an app gets it: the endpoint needs the api:read or mcp scope.
     */
    private function signedInWithToken(User $user): static
    {
        Passport::actingAs($user, ['api:read']);

        return $this;
    }
}
