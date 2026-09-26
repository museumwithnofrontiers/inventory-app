<?php

namespace Tests\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Widgets\MissingFallbackTranslationsWidget;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\Partner;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class MissingFallbackTranslationsWidgetTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_widget_shows_items_missing_fallback_translation(): void
    {
        $user = $this->createViewDataUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $itemMissing = Item::factory()->Object()->create(['internal_name' => 'No fallback item']);

        $itemWithFallback = Item::factory()->Object()->create(['internal_name' => 'Has fallback item']);
        $itemWithFallback->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Has fallback item',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MissingFallbackTranslationsWidget::class, ['ownerType' => 'item'])
            ->assertCanSeeTableRecords([$itemMissing])
            ->assertCanNotSeeTableRecords([$itemWithFallback]);
    }

    public function test_widget_shows_collections_missing_fallback_translation(): void
    {
        $user = $this->createViewDataUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $collectionMissing = Collection::factory()->create(['internal_name' => 'No fallback collection']);

        $collectionWithFallback = Collection::factory()->create(['internal_name' => 'Has fallback collection']);
        $collectionWithFallback->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'title' => 'Has fallback collection',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MissingFallbackTranslationsWidget::class, ['ownerType' => 'collection'])
            ->assertCanSeeTableRecords([$collectionMissing])
            ->assertCanNotSeeTableRecords([$collectionWithFallback]);
    }

    public function test_widget_shows_partners_missing_fallback_translation(): void
    {
        $user = $this->createViewDataUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $partnerMissing = Partner::factory()->create(['internal_name' => 'No fallback partner']);

        $partnerWithFallback = Partner::factory()->create(['internal_name' => 'Has fallback partner']);
        $partnerWithFallback->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Has fallback partner',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MissingFallbackTranslationsWidget::class, ['ownerType' => 'partner'])
            ->assertCanSeeTableRecords([$partnerMissing])
            ->assertCanNotSeeTableRecords([$partnerWithFallback]);
    }

    public function test_widget_reflects_current_default_language_and_context(): void
    {
        $user = $this->createViewDataUser();
        $langEn = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $langFr = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
        $ctxDefault = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $itemEnglish = Item::factory()->Object()->create(['internal_name' => 'English item']);
        $itemEnglish->translations()->create([
            'language_id' => $langEn->id,
            'context_id' => $ctxDefault->id,
            'name' => 'English item',
        ]);

        $itemFrenchOnly = Item::factory()->Object()->create(['internal_name' => 'French only item']);
        $itemFrenchOnly->translations()->create([
            'language_id' => $langFr->id,
            'context_id' => $ctxDefault->id,
            'name' => 'French only item',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MissingFallbackTranslationsWidget::class, ['ownerType' => 'item'])
            ->assertCanSeeTableRecords([$itemFrenchOnly])
            ->assertCanNotSeeTableRecords([$itemEnglish]);

        $langFr->setDefault();

        Livewire::actingAs($user)
            ->test(MissingFallbackTranslationsWidget::class, ['ownerType' => 'item'])
            ->assertCanSeeTableRecords([$itemEnglish])
            ->assertCanNotSeeTableRecords([$itemFrenchOnly]);
    }

    public function test_user_with_view_data_permission_can_see_widget(): void
    {
        $user = $this->createViewDataUser();

        $this->actingAs($user);
        $this->setCurrentPanel();

        $this->assertTrue(
            MissingFallbackTranslationsWidget::canView()
        );
    }

    public function test_user_without_view_data_permission_cannot_see_widget(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
        ]);

        $this->actingAs($user);
        $this->setCurrentPanel();

        $this->assertFalse(
            MissingFallbackTranslationsWidget::canView()
        );
    }

    public function test_widget_links_to_item_resource_view_page(): void
    {
        $user = $this->createViewDataUser();
        Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $item = Item::factory()->Object()->create(['internal_name' => 'No fallback item']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MissingFallbackTranslationsWidget::class, ['ownerType' => 'item'])
            ->assertCanSeeTableRecords([$item]);
    }

    protected function createViewDataUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
        ]);

        return $user;
    }
}
