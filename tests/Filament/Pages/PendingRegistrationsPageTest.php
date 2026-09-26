<?php

namespace Tests\Filament\Pages;

use App\Enums\Permission;
use App\Filament\Pages\PendingRegistrationsPage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class PendingRegistrationsPageTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    protected function createManagerUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::MANAGE_USERS->value,
        ]);

        return $user;
    }

    public function test_pending_registrations_page_is_accessible_to_authorized_users(): void
    {
        $manager = $this->createManagerUser();

        $this->actingAs($manager)->get('/admin/pending-registrations-page')
            ->assertOk();
    }

    public function test_pending_registrations_page_shows_only_pending_users(): void
    {
        $manager = $this->createManagerUser();
        $pending = User::factory()->create(['approved_at' => null, 'email_verified_at' => now()]);
        $approved = User::factory()->create(['approved_at' => now(), 'email_verified_at' => now()]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(PendingRegistrationsPage::class)
            ->assertCanSeeTableRecords([$pending])
            ->assertCanNotSeeTableRecords([$approved]);
    }

    public function test_approve_action_sets_approved_at(): void
    {
        $manager = $this->createManagerUser();
        $pending = User::factory()->create(['approved_at' => null, 'email_verified_at' => now()]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(PendingRegistrationsPage::class)
            ->callTableAction('approve', $pending)
            ->assertHasNoTableActionErrors();

        $this->assertNotNull($pending->fresh()->approved_at);
    }

    public function test_reject_action_deletes_the_user(): void
    {
        $manager = $this->createManagerUser();
        $pending = User::factory()->create(['approved_at' => null, 'email_verified_at' => now()]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(PendingRegistrationsPage::class)
            ->callTableAction('reject', $pending)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('users', ['id' => $pending->id]);
    }
}
