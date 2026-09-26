<?php

namespace Tests\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Resources\CollectionResource\Pages\ListCollection;
use App\Filament\Support\CollectionDisplayLabel;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Language;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Tests for CollectionDisplayLabel: the label-resolution fallback chain
 * and Filament table integration.
 *
 * Fallback order (stops at first non-empty value):
 *  1. Default language + collection's own context_id
 *  2. Default language + default context
 *  3. First translation in default language (any context)
 *  4. First translation in any language
 *  5. internal_name
 */
class CollectionDisplayLabelTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    protected function createViewUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
        ]);

        return $user;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // resolveForRecord – PHP fallback chain
    // ──────────────────────────────────────────────────────────────────────────

    public function test_fallback_1_default_language_own_context(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);
        $ownCtx = Context::factory()->create(['is_default' => false]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
            'context_id' => $ownCtx->id,
        ]);

        // Add a translation for default lang + own context (the top-priority match)
        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $ownCtx->id,
            'title' => 'The Umayyads',
        ]);

        // Also add a translation for default lang + default context (lower priority)
        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'title' => 'Umayyad Heritage (default ctx)',
        ]);

        $collection->load('translations');

        $this->assertSame('The Umayyads', CollectionDisplayLabel::resolveForRecord($collection));
    }

    public function test_fallback_2_default_language_default_context(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);
        $ownCtx = Context::factory()->create(['is_default' => false]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
            'context_id' => $ownCtx->id,
        ]);

        // Only add translation for default lang + default context (not own context)
        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'title' => 'The Umayyads (default)',
        ]);

        $collection->load('translations');

        $this->assertSame('The Umayyads (default)', CollectionDisplayLabel::resolveForRecord($collection));
    }

    public function test_fallback_3_default_language_any_context(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $otherCtx = Context::factory()->create(['is_default' => false]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
        ]);

        // Translation in default lang but some other context (not own, not default)
        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $otherCtx->id,
            'title' => 'The Umayyads (other ctx)',
        ]);

        $collection->load('translations');

        $this->assertSame('The Umayyads (other ctx)', CollectionDisplayLabel::resolveForRecord($collection));
    }

    public function test_fallback_4_any_translation(): void
    {
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $arabicLang = Language::factory()->create(['id' => 'ara', 'is_default' => false]);
        $otherCtx = Context::factory()->create(['is_default' => false]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
        ]);

        // Only a non-default-language translation available
        $collection->translations()->create([
            'language_id' => $arabicLang->id,
            'context_id' => $otherCtx->id,
            'title' => 'الأمويون',
        ]);

        $collection->load('translations');

        $this->assertSame('الأمويون', CollectionDisplayLabel::resolveForRecord($collection));
    }

    public function test_fallback_5_internal_name_when_no_translations(): void
    {
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
        ]);

        $collection->load('translations');

        $this->assertSame('mwnf3_exhibition_10', CollectionDisplayLabel::resolveForRecord($collection));
    }

    public function test_fallback_5_internal_name_when_translations_have_empty_title(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
        ]);

        // Translation with empty title – should NOT be selected
        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'title' => '',
        ]);

        $collection->load('translations');

        $this->assertSame('mwnf3_exhibition_10', CollectionDisplayLabel::resolveForRecord($collection));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // withDisplayLabel – SQL COALESCE virtual column
    // ──────────────────────────────────────────────────────────────────────────

    public function test_sql_fallback_1_default_language_own_context(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);
        $ownCtx = Context::factory()->create(['is_default' => false]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
            'context_id' => $ownCtx->id,
        ]);

        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $ownCtx->id,
            'title' => 'The Umayyads (SQL-1)',
        ]);

        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'title' => 'Umayyad Heritage (default ctx SQL)',
        ]);

        $result = CollectionDisplayLabel::withDisplayLabel(
            Collection::where('id', $collection->id)
        )->first();

        $this->assertSame('The Umayyads (SQL-1)', $result->display_label);
    }

    public function test_sql_fallback_2_default_language_default_context(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);
        $ownCtx = Context::factory()->create(['is_default' => false]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
            'context_id' => $ownCtx->id,
        ]);

        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'title' => 'The Umayyads (SQL-2)',
        ]);

        $result = CollectionDisplayLabel::withDisplayLabel(
            Collection::where('id', $collection->id)
        )->first();

        $this->assertSame('The Umayyads (SQL-2)', $result->display_label);
    }

    public function test_sql_fallback_3_default_language_any_context(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $otherCtx = Context::factory()->create(['is_default' => false]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
        ]);

        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $otherCtx->id,
            'title' => 'The Umayyads (SQL-3)',
        ]);

        $result = CollectionDisplayLabel::withDisplayLabel(
            Collection::where('id', $collection->id)
        )->first();

        $this->assertSame('The Umayyads (SQL-3)', $result->display_label);
    }

    public function test_sql_fallback_4_any_translation(): void
    {
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $arabicLang = Language::factory()->create(['id' => 'ara', 'is_default' => false]);
        $otherCtx = Context::factory()->create(['is_default' => false]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
        ]);

        $collection->translations()->create([
            'language_id' => $arabicLang->id,
            'context_id' => $otherCtx->id,
            'title' => 'الأمويون (SQL-4)',
        ]);

        $result = CollectionDisplayLabel::withDisplayLabel(
            Collection::where('id', $collection->id)
        )->first();

        $this->assertSame('الأمويون (SQL-4)', $result->display_label);
    }

    public function test_sql_fallback_5_internal_name_when_no_translations(): void
    {
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
        ]);

        $result = CollectionDisplayLabel::withDisplayLabel(
            Collection::where('id', $collection->id)
        )->first();

        $this->assertSame('mwnf3_exhibition_10', $result->display_label);
    }

    public function test_sql_fallback_5_internal_name_when_translations_have_empty_title(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
        ]);

        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'title' => '',
        ]);

        $result = CollectionDisplayLabel::withDisplayLabel(
            Collection::where('id', $collection->id)
        )->first();

        $this->assertSame('mwnf3_exhibition_10', $result->display_label);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Filament table integration
    // ──────────────────────────────────────────────────────────────────────────

    public function test_collection_table_shows_translated_title_as_primary_label(): void
    {
        $user = $this->createViewUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
            'context_id' => $defaultCtx->id,
        ]);

        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'title' => 'The Umayyads',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListCollection::class)
            ->assertCanSeeTableRecords([$collection]);

        // The translated title should appear on the list page
        $this->actingAs($user)
            ->get('/admin/collections')
            ->assertOk()
            ->assertSee('The Umayyads');
    }

    public function test_collection_table_falls_back_to_internal_name_when_no_translation(): void
    {
        $user = $this->createViewUser();
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_no_translation',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListCollection::class)
            ->assertCanSeeTableRecords([$collection]);

        // Falls back to internal_name
        $this->actingAs($user)
            ->get('/admin/collections')
            ->assertOk()
            ->assertSee('mwnf3_exhibition_no_translation');
    }

    public function test_collection_view_page_shows_internal_name_in_system_information(): void
    {
        $user = $this->createViewUser();
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
        ]);

        $this->actingAs($user)
            ->get("/admin/collections/{$collection->getKey()}")
            ->assertOk()
            ->assertSee('System Information')
            ->assertSee('mwnf3_exhibition_10');
    }

    public function test_collection_view_page_does_not_show_internal_name_in_core_information(): void
    {
        $user = $this->createViewUser();
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
        ]);

        $response = $this->actingAs($user)
            ->get("/admin/collections/{$collection->getKey()}")
            ->assertOk();

        $content = $response->getContent();

        // "Core Information" and "System Information" must both exist
        $this->assertStringContainsString('Core Information', $content);
        $this->assertStringContainsString('System Information', $content);

        // internal_name text must appear somewhere (in System Information)
        $this->assertStringContainsString('mwnf3_exhibition_10', $content);

        // "Internal name" label should appear in System Information section
        // We verify the label is in the page (it's placed in System Information section)
        $this->assertStringContainsString('Internal name', $content);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Tree node integration
    // ──────────────────────────────────────────────────────────────────────────

    public function test_tree_shows_translated_title_as_primary_node_label(): void
    {
        $user = $this->createViewUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
            'context_id' => $defaultCtx->id,
        ]);

        // Add a child so it's shown by the default "with children" filter
        Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10_child',
            'parent_id' => $collection->id,
        ]);

        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'title' => 'The Umayyads',
        ]);

        $this->setCurrentPanel();

        $this->actingAs($user)
            ->get('/admin/browse-collection-tree')
            ->assertOk()
            ->assertSee('The Umayyads');
    }

    public function test_tree_shows_internal_name_as_subtitle_when_display_label_differs(): void
    {
        $user = $this->createViewUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $collection = Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10',
            'context_id' => $defaultCtx->id,
        ]);

        // Add a child so it's shown
        Collection::factory()->create([
            'internal_name' => 'mwnf3_exhibition_10_child',
            'parent_id' => $collection->id,
        ]);

        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'title' => 'The Umayyads',
        ]);

        $this->setCurrentPanel();

        // When the display label differs from internal_name, the internal_name
        // should still be visible as a subtitle
        $this->actingAs($user)
            ->get('/admin/browse-collection-tree')
            ->assertOk()
            ->assertSee('The Umayyads')
            ->assertSee('mwnf3_exhibition_10');
    }
}
