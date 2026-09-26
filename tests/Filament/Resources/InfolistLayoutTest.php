<?php

namespace Tests\Filament\Resources;

use App\Enums\Permission;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Item;
use App\Models\ItemTranslation;
use App\Models\Language;
use App\Models\Partner;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Asserts that view pages use the improved infolist layout:
 * - Domain data in "Core Information" (or equivalent named section)
 * - System data (UUID, legacy code, timestamps) in a separate "System Information" section
 * - Extra JSON in its own "Extra Data" section when present
 * - Translation resources show parent record in "Translation For" section
 */
class InfolistLayoutTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Item ────────────────────────────────────────────────────────────────────

    public function test_item_view_page_has_core_information_and_system_information_sections(): void
    {
        $user = $this->createViewUser();
        $item = Item::factory()->Object()->create(['internal_name' => 'Stone Tablet']);

        $this->actingAs($user)
            ->get("/admin/items/{$item->getKey()}")
            ->assertOk()
            ->assertSee('Core Information')
            ->assertSee('System Information');
    }

    public function test_item_view_page_system_information_section_contains_uuid(): void
    {
        $user = $this->createViewUser();
        $item = Item::factory()->Object()->create(['backward_compatibility' => 'itm-legacy-01']);

        $response = $this->actingAs($user)->get("/admin/items/{$item->getKey()}");
        $response->assertOk();
        $content = $response->getContent();

        // UUID should appear inside "System Information" context
        $this->assertStringContainsString('System Information', $content);
        $this->assertStringContainsString($item->id, $content);
        $this->assertStringContainsString('itm-legacy-01', $content);
    }

    // ── Partner ─────────────────────────────────────────────────────────────────

    public function test_partner_view_page_has_core_information_and_system_information_sections(): void
    {
        $user = $this->createViewUser();
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);

        $this->actingAs($user)
            ->get("/admin/partners/{$partner->getKey()}")
            ->assertOk()
            ->assertSee('Core Information')
            ->assertSee('System Information');
    }

    public function test_partner_edit_page_has_core_information_form_section(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);

        $this->actingAs($user)
            ->get("/admin/partners/{$partner->getKey()}/edit")
            ->assertOk()
            ->assertSee('Core information');
    }

    // ── Collection ──────────────────────────────────────────────────────────────

    public function test_collection_view_page_has_core_information_and_system_information_sections(): void
    {
        $user = $this->createViewUser();
        $collection = Collection::factory()->create(['internal_name' => 'Roman Gallery']);

        $this->actingAs($user)
            ->get("/admin/collections/{$collection->getKey()}")
            ->assertOk()
            ->assertSee('Core Information')
            ->assertSee('System Information');
    }

    // ── Context ─────────────────────────────────────────────────────────────────

    public function test_context_view_page_has_core_information_and_system_information_sections(): void
    {
        $user = $this->createReferenceDataUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);

        $this->actingAs($user)
            ->get("/admin/contexts/{$context->getKey()}")
            ->assertOk()
            ->assertSee('Core Information')
            ->assertSee('System Information');
    }

    // ── ItemTranslation ─────────────────────────────────────────────────────────

    public function test_item_translation_view_page_has_translation_for_extra_data_and_system_information_sections(): void
    {
        $user = $this->createViewUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple Relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
            'extra' => ['notice' => 'A public notice'],
        ]);

        $this->actingAs($user)
            ->get("/admin/item-translations/{$translation->getKey()}")
            ->assertOk()
            ->assertSee('Translation For')
            ->assertSee('Extra Data')
            ->assertSee('System Information');
    }

    public function test_item_translation_view_page_does_not_have_legacy_metadata_section(): void
    {
        $user = $this->createViewUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple Relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->actingAs($user)
            ->get("/admin/item-translations/{$translation->getKey()}")
            ->assertOk()
            ->assertDontSee('Legacy & Metadata');
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    protected function createViewUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
        ]);

        return $user;
    }
}
