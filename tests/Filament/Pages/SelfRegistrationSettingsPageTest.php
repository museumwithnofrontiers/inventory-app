<?php

namespace Tests\Filament\Pages;

use App\Enums\Permission;
use App\Filament\Pages\SelfRegistrationSettingsPage;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class SelfRegistrationSettingsPageTest extends TestCase
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

    public function test_self_registration_settings_page_is_accessible_to_authorized_users(): void
    {
        $manager = $this->createManagerUser();

        $this->actingAs($manager)->get('/admin/self-registration-settings-page')
            ->assertOk();
    }

    public function test_self_registration_can_be_toggled_on(): void
    {
        $manager = $this->createManagerUser();

        Setting::set('self_registration_enabled', false, 'boolean');

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(SelfRegistrationSettingsPage::class)
            ->set('self_registration_enabled', true)
            ->call('save')
            ->assertHasNoErrors();

        $this->assertTrue((bool) Setting::get('self_registration_enabled'));
    }

    public function test_self_registration_can_be_toggled_off(): void
    {
        $manager = $this->createManagerUser();

        Setting::set('self_registration_enabled', true, 'boolean');

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(SelfRegistrationSettingsPage::class)
            ->set('self_registration_enabled', false)
            ->call('save')
            ->assertHasNoErrors();

        $this->assertFalse((bool) Setting::get('self_registration_enabled'));
    }

    public function test_page_loads_current_setting_on_mount(): void
    {
        $manager = $this->createManagerUser();

        Setting::set('self_registration_enabled', true, 'boolean');

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(SelfRegistrationSettingsPage::class)
            ->assertSet('self_registration_enabled', true);
    }
}
