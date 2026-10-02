<?php

namespace Tests\Api\User;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CurrentUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_returns_the_signed_in_user(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('id', $user->id)
            ->assertJsonPath('email', $user->email);
    }

    public function test_it_no_longer_carries_a_profile_photo_url(): void
    {
        // A generated avatar link, dropped with the package that appended it (M8)
        $this->actingAs(User::factory()->create())
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonMissingPath('profile_photo_url');
    }

    public function test_a_guest_gets_unauthorized(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }
}
