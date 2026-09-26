<?php

namespace Tests\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Resources\AuthorResource;
use App\Filament\Resources\AvailableImageResource;
use App\Filament\Resources\AvailableImageResource\Pages\ListAvailableImage;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\CollectionTranslationResource;
use App\Filament\Resources\ContextResource;
use App\Filament\Resources\ContextResource\Pages\ListContext;
use App\Filament\Resources\CountryResource;
use App\Filament\Resources\GlossaryResource;
use App\Filament\Resources\ItemItemLinkResource;
use App\Filament\Resources\ItemResource;
use App\Filament\Resources\ItemResource\Pages\ListItem;
use App\Filament\Resources\ItemTranslationResource;
use App\Filament\Resources\LanguageResource;
use App\Filament\Resources\PartnerResource;
use App\Filament\Resources\PartnerTranslationResource;
use App\Filament\Resources\ProjectResource;
use App\Filament\Resources\RoleResource;
use App\Filament\Resources\TagResource;
use App\Filament\Resources\TimelineEventResource;
use App\Filament\Resources\TimelineResource;
use App\Filament\Resources\UserResource;
use App\Models\AvailableImage;
use App\Models\Context;
use App\Models\Item;
use App\Models\User;
use Filament\Facades\Filament;
use Filament\Navigation\NavigationGroup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Asserts that:
 * 1. AvailableImageResource uses the "Available Images" navigation group label.
 * 2. All resources belong to the expected navigation groups.
 * 3. The panel registers navigation groups in the requested order.
 * 4. Every resource list row links to the view page on click (recordUrl convention).
 */
class NavigationConsistencyTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Helpers ───────────────────────────────────────────────────────────────

    protected function createViewUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
        ]);

        return $user;
    }

    // ── Navigation group label ─────────────────────────────────────────────────

    public function test_available_image_resource_uses_available_images_navigation_group(): void
    {
        $this->assertEquals('Available Images', AvailableImageResource::getNavigationGroup());
    }

    // ── Navigation group assignment ────────────────────────────────────────────

    /** @return array<string, array{class-string, string}> */
    public static function resourceNavigationGroupProvider(): array
    {
        return [
            'Item → Inventory' => [ItemResource::class, 'Inventory'],
            'Collection → Inventory' => [CollectionResource::class, 'Inventory'],
            'Partner → Inventory' => [PartnerResource::class, 'Inventory'],
            'Project → Inventory' => [ProjectResource::class, 'Inventory'],
            'ItemItemLink → Inventory' => [ItemItemLinkResource::class, 'Inventory'],
            'Timeline → Inventory' => [TimelineResource::class, 'Inventory'],
            'TimelineEvent → Inventory' => [TimelineEventResource::class, 'Inventory'],
            'Context → Shared Data' => [ContextResource::class, 'Shared Data'],
            'Tag → Shared Data' => [TagResource::class, 'Shared Data'],
            'Author → Shared Data' => [AuthorResource::class, 'Shared Data'],
            'Glossary → Shared Data' => [GlossaryResource::class, 'Shared Data'],
            'AvailableImage → Available Images' => [AvailableImageResource::class, 'Available Images'],
            'ItemTranslation → Translations' => [ItemTranslationResource::class, 'Translations'],
            'CollectionTranslation → Translations' => [CollectionTranslationResource::class, 'Translations'],
            'PartnerTranslation → Translations' => [PartnerTranslationResource::class, 'Translations'],
            'Language → Reference Data' => [LanguageResource::class, 'Reference Data'],
            'Country → Reference Data' => [CountryResource::class, 'Reference Data'],
            'Role → Administration' => [RoleResource::class, 'Administration'],
            'User → Administration' => [UserResource::class, 'Administration'],
        ];
    }

    /**
     * @param  class-string  $resourceClass
     */
    #[DataProvider('resourceNavigationGroupProvider')]
    public function test_resource_belongs_to_expected_navigation_group(string $resourceClass, string $expectedGroup): void
    {
        $this->assertEquals($expectedGroup, $resourceClass::getNavigationGroup());
    }

    // ── Panel navigation group order ───────────────────────────────────────────

    public function test_panel_navigation_groups_are_registered_in_requested_order(): void
    {
        $this->setCurrentPanel();

        $panel = Filament::getPanel('admin');
        $groups = $panel->getNavigationGroups();

        $this->assertNotEmpty($groups, 'Panel must have explicit navigation groups configured.');

        $labels = array_map(
            fn (NavigationGroup $group): string => $group->getLabel(),
            $groups,
        );

        $expectedOrder = ['Inventory', 'Shared Data', 'Available Images', 'Translations', 'Reference Data', 'Administration'];

        foreach ($expectedOrder as $index => $expectedLabel) {
            $this->assertContains($expectedLabel, $labels, "Navigation group '{$expectedLabel}' must be registered in the panel.");
        }

        // Verify relative order: each group must appear before the next.
        $orderCount = count($expectedOrder);
        for ($i = 0; $i < $orderCount - 1; $i++) {
            $posA = array_search($expectedOrder[$i], $labels, true);
            $posB = array_search($expectedOrder[$i + 1], $labels, true);
            $this->assertLessThan(
                $posB,
                $posA,
                "Navigation group '{$expectedOrder[$i]}' must appear before '{$expectedOrder[$i + 1]}'."
            );
        }
    }

    // ── Row URL convention (recordUrl) ─────────────────────────────────────────

    public function test_context_list_row_links_to_view_page(): void
    {
        $user = $this->createReferenceDataUser();
        $context = Context::factory()->withIsDefault()->create(['internal_name' => 'Catalogue']);

        $this->setCurrentPanel();

        $expectedUrl = ContextResource::getUrl('view', ['record' => $context]);

        Livewire::actingAs($user)
            ->test(ListContext::class)
            ->assertSeeHtml(htmlspecialchars($expectedUrl));
    }

    public function test_item_list_row_links_to_view_page(): void
    {
        $user = $this->createViewUser();
        $item = Item::factory()->Object()->create(['internal_name' => 'Terracotta Vase']);

        $this->setCurrentPanel();

        $expectedUrl = ItemResource::getUrl('view', ['record' => $item]);

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->assertSeeHtml(htmlspecialchars($expectedUrl));
    }

    public function test_available_image_list_row_links_to_view_page(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $user = $this->createViewUser();
        $availableImage = AvailableImage::factory()->create();

        $this->setCurrentPanel();

        $expectedUrl = AvailableImageResource::getUrl('view', ['record' => $availableImage]);

        Livewire::actingAs($user)
            ->test(ListAvailableImage::class)
            ->assertSeeHtml(htmlspecialchars($expectedUrl));
    }
}
