<?php

namespace Tests\Unit\Authorization;

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\Authorization\UserRoles;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Laravel\Passport\Database\Factories\ClientFactory;
use LogicException;
use Tests\TestCase;

/**
 * Every account change reaches the audit log, entries cannot be changed or
 * deleted, a user holds one role, and suspending a user cuts off their
 * sessions and OAuth tokens.
 */
class AccountAuditAndRevocationTest extends TestCase
{
    use RefreshDatabase;

    public function test_account_changes_are_logged_without_secrets(): void
    {
        $user = User::factory()->create(['name' => 'Before']);

        $user->update(['name' => 'After', 'password' => 'a-new-secret-password']);

        $entry = AuditLog::query()->where('action', 'user.updated')->where('subject_id', (string) $user->id)->latest('id')->firstOrFail();
        $this->assertSame(['from' => 'Before', 'to' => 'After'], $entry->changes['name'] ?? null);
        $this->assertSame('changed', $entry->changes['password'] ?? null);
        $this->assertStringNotContainsString('a-new-secret-password', (string) json_encode($entry->changes));
        $this->assertSame('console', $entry->channel);
        $this->assertStringStartsWith('console: ', $entry->actor_label);
    }

    public function test_a_panel_actor_is_recorded(): void
    {
        $manager = User::factory()->create();
        $target = User::factory()->create();

        $this->actingAs($manager);
        $target->update(['suspended_at' => now()]);

        $entry = AuditLog::query()->where('action', 'user.suspended')->firstOrFail();
        $this->assertSame($manager->id, $entry->actor_id);
        $this->assertSame($manager->email, $entry->actor_label);
        $this->assertSame($target->email, $entry->subject_label);
    }

    public function test_role_changes_are_logged(): void
    {
        $user = User::factory()->create();

        app(UserRoles::class)->assign($user, Role::VISITOR);
        app(UserRoles::class)->assign($user, Role::DATA_MANAGER);

        $this->assertDatabaseHas('audit_logs', ['action' => 'user.role_added', 'subject_id' => (string) $user->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.role_removed', 'subject_id' => (string) $user->id]);
        $this->assertSame(
            [['roles' => ['Visitor']], ['roles' => ['Manager of Data']]],
            AuditLog::query()->where('action', 'user.role_added')->where('subject_id', (string) $user->id)->orderBy('id')->pluck('changes')->all(),
        );
    }

    public function test_entries_cannot_be_changed_or_deleted(): void
    {
        $entry = AuditLog::factory()->create();
        $action = $entry->action;

        try {
            $entry->update(['action' => 'forged']);
            $this->fail('An audit log entry was changed.');
        } catch (LogicException) {
        }

        try {
            $entry->delete();
            $this->fail('An audit log entry was deleted.');
        } catch (LogicException) {
        }

        $this->assertDatabaseHas('audit_logs', ['id' => $entry->id, 'action' => $action]);
    }

    public function test_a_user_holds_one_role_at_most(): void
    {
        $user = User::factory()->create();
        $user->assignRole(Role::VISITOR->value);

        $this->expectException(QueryException::class);
        $user->assignRole(Role::DATA_MANAGER->value);
    }

    public function test_assign_replaces_the_role(): void
    {
        $user = User::factory()->create();
        app(UserRoles::class)->assign($user, Role::VISITOR);
        app(UserRoles::class)->assign($user, Role::DATA_MANAGER);

        $this->assertSame([Role::DATA_MANAGER->value], $user->fresh()?->roles->pluck('name')->all());
    }

    public function test_there_is_only_one_superadmin(): void
    {
        $first = User::factory()->create();
        $second = User::factory()->create();
        app(UserRoles::class)->assign($first, Role::SUPERADMIN);

        try {
            app(UserRoles::class)->assign($second, Role::SUPERADMIN);
            $this->fail('A second superadmin was appointed.');
        } catch (InvalidArgumentException) {
        }

        app(UserRoles::class)->transferSuperadmin($second);

        $this->assertSame(Role::USER_MANAGER, $first->fresh()?->currentRole());
        $this->assertSame(Role::SUPERADMIN, $second->fresh()?->currentRole());
    }

    public function test_suspending_a_user_revokes_their_tokens_and_sessions(): void
    {
        Config::set('session.driver', 'database');
        $user = User::factory()->create();
        $other = User::factory()->create();
        $client = ClientFactory::new()->create();

        foreach ([$user, $other] as $owner) {
            DB::table('oauth_access_tokens')->insert([
                'id' => "access-{$owner->id}", 'user_id' => $owner->id, 'client_id' => $client->getKey(),
                'scopes' => '["mcp"]', 'revoked' => false, 'created_at' => now(), 'updated_at' => now(), 'expires_at' => now()->addHour(),
            ]);
            DB::table('oauth_refresh_tokens')->insert([
                'id' => "refresh-{$owner->id}", 'access_token_id' => "access-{$owner->id}", 'revoked' => false, 'expires_at' => now()->addDay(),
            ]);
            DB::table('oauth_auth_codes')->insert([
                'id' => "code-{$owner->id}", 'user_id' => $owner->id, 'client_id' => $client->getKey(),
                'scopes' => '["mcp"]', 'revoked' => false, 'expires_at' => now()->addMinutes(10),
            ]);
            DB::table('sessions')->insert([
                'id' => "session-{$owner->id}", 'user_id' => $owner->id, 'ip_address' => null, 'user_agent' => null,
                'payload' => '', 'last_activity' => time(),
            ]);
        }

        $user->update(['suspended_at' => now()]);

        $this->assertDatabaseHas('oauth_access_tokens', ['id' => "access-{$user->id}", 'revoked' => true]);
        $this->assertDatabaseHas('oauth_refresh_tokens', ['id' => "refresh-{$user->id}", 'revoked' => true]);
        $this->assertDatabaseHas('oauth_auth_codes', ['id' => "code-{$user->id}", 'revoked' => true]);
        $this->assertDatabaseMissing('sessions', ['id' => "session-{$user->id}"]);

        $this->assertDatabaseHas('oauth_access_tokens', ['id' => "access-{$other->id}", 'revoked' => false]);
        $this->assertDatabaseHas('sessions', ['id' => "session-{$other->id}"]);

        $entry = AuditLog::query()->where('action', 'user.access_revoked')->firstOrFail();
        $this->assertSame(['sessions' => 1, 'access_tokens' => 1, 'refresh_tokens' => 1, 'auth_codes' => 1], $entry->changes);
    }
}
