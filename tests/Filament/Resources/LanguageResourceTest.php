<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\LanguageResource\Pages\CreateLanguage;
use App\Filament\Resources\LanguageResource\Pages\EditLanguage;
use App\Filament\Resources\LanguageResource\Pages\ListLanguage;
use App\Models\Language;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class LanguageResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_authorized_users_can_render_all_language_resource_pages(): void
    {
        $user = $this->createReferenceDataUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        $this->actingAs($user)->get('/admin/languages')
            ->assertOk()
            ->assertSee('Languages');

        $this->actingAs($user)->get('/admin/languages/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/languages/{$language->getKey()}/edit")
            ->assertOk()
            ->assertSee('English');

        $this->actingAs($user)->get("/admin/languages/{$language->getKey()}")
            ->assertOk()
            ->assertSee('English')
            ->assertSee('eng');
    }

    public function test_authorized_users_can_create_edit_and_delete_languages(): void
    {
        $user = $this->createReferenceDataUser();
        $language = Language::factory()->create([
            'id' => 'eng',
            'internal_name' => 'English',
            'backward_compatibility' => 'en',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateLanguage::class)
            ->fillForm([
                'id' => 'ara',
                'internal_name' => 'Arabic',
                'backward_compatibility' => 'ar',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('languages', [
            'id' => 'ara',
            'internal_name' => 'Arabic',
            'backward_compatibility' => 'ar',
        ]);

        Livewire::actingAs($user)
            ->test(EditLanguage::class, [
                'record' => $language->getRouteKey(),
            ])
            ->assertFormSet([
                'id' => 'eng',
                'internal_name' => 'English',
                'backward_compatibility' => 'en',
            ])
            ->fillForm([
                'internal_name' => 'Modern English',
                'backward_compatibility' => 'me',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('languages', [
            'id' => 'eng',
            'internal_name' => 'Modern English',
            'backward_compatibility' => 'me',
        ]);

        Livewire::actingAs($user)
            ->test(ListLanguage::class)
            ->callTableAction(DeleteAction::class, $language)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('languages', [
            'id' => 'eng',
        ]);
    }

    public function test_language_resource_filters_by_default_status_and_sets_the_default_language(): void
    {
        $user = $this->createReferenceDataUser();
        $defaultLanguage = Language::factory()->withIsDefault()->create([
            'id' => 'eng',
            'internal_name' => 'English',
        ]);
        $arabic = Language::factory()->create([
            'id' => 'ara',
            'internal_name' => 'Arabic',
            'is_default' => false,
        ]);
        $french = Language::factory()->create([
            'id' => 'fra',
            'internal_name' => 'French',
            'is_default' => false,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListLanguage::class)
            ->filterTable('is_default', true)
            ->assertCanSeeTableRecords([$defaultLanguage])
            ->assertCanNotSeeTableRecords([$arabic, $french]);

        Livewire::actingAs($user)
            ->test(ListLanguage::class)
            ->callTableBulkAction('setDefault', [$arabic])
            ->assertNotified('Default language updated');

        $this->assertTrue($arabic->fresh()->is_default);
        $this->assertFalse($defaultLanguage->fresh()->is_default);

        Livewire::actingAs($user)
            ->test(ListLanguage::class)
            ->callTableBulkAction('setDefault', [$arabic, $french])
            ->assertNotified('Select exactly one language');

        $this->assertTrue($arabic->fresh()->is_default);
        $this->assertFalse($french->fresh()->is_default);
    }
}
