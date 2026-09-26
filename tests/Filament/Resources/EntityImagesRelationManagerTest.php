<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\CollectionResource\Pages\EditCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\ImagesRelationManager as CollectionImagesRelationManager;
use App\Filament\Resources\ItemResource\Pages\EditItem;
use App\Filament\Resources\ItemResource\RelationManagers\ImagesRelationManager as ItemImagesRelationManager;
use App\Filament\Resources\PartnerResource\Pages\EditPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\ImagesRelationManager as PartnerImagesRelationManager;
use App\Models\AvailableImage;
use App\Models\Collection;
use App\Models\CollectionImage;
use App\Models\Item;
use App\Models\ItemImage;
use App\Models\Partner;
use App\Models\PartnerImage;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class EntityImagesRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ─── Item images ──────────────────────────────────────────────────────────

    public function test_item_images_relation_manager_renders(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemImagesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertSuccessful();
    }

    public function test_item_images_relation_manager_lists_attached_images(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $image = ItemImage::factory()->forItem($item)->create(['path' => 'item-test.jpg']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemImagesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertCanSeeTableRecords([$image]);
    }

    public function test_item_images_delete_action_is_labelled_delete_permanently(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemImagesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionExists('delete')
            ->assertTableActionHasLabel('delete', 'Delete permanently');
    }

    public function test_item_images_edit_action_updates_copyright_and_stores_null_for_blank(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $image = ItemImage::factory()->forItem($item)->create(['path' => 'copyright-item.jpg', 'copyright' => 'Old copyright']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemImagesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->mountTableAction('edit', $image)
            ->setTableActionData([
                'alt_text' => $image->alt_text,
                'display_order' => $image->display_order,
                'copyright' => 'New copyright holder',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_images', [
            'id' => $image->id,
            'copyright' => 'New copyright holder',
        ]);

        Livewire::actingAs($user)
            ->test(ItemImagesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->mountTableAction('edit', $image)
            ->setTableActionData([
                'alt_text' => $image->alt_text,
                'display_order' => $image->display_order,
                'copyright' => '',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_images', [
            'id' => $image->id,
            'copyright' => null,
        ]);
    }

    public function test_item_images_detach_action_moves_image_to_available_pool(): void
    {
        Storage::fake('public');

        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $image = ItemImage::factory()->forItem($item)->create(['path' => 'detach-item.jpg']);

        $picturesDir = trim(config('localstorage.pictures.directory'), '/');
        Storage::disk(config('localstorage.pictures.disk'))->put($picturesDir.'/detach-item.jpg', 'fake-data');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemImagesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->callTableAction('detach', $image)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_images', ['id' => $image->id]);
        $this->assertDatabaseHas('available_images', ['id' => $image->id]);
    }

    public function test_item_images_delete_permanently_removes_image_without_returning_to_pool(): void
    {
        Storage::fake('public');
        Storage::fake('image-originals');

        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $image = ItemImage::factory()->forItem($item)->create(['path' => 'delete-item.jpg']);

        $picturesDir = trim(config('localstorage.pictures.directory'), '/');
        Storage::disk(config('localstorage.pictures.disk'))->put($picturesDir.'/delete-item.jpg', 'fake-data');

        $originalsDir = trim(config('localstorage.available.images.directory'), '/');
        Storage::disk(config('localstorage.available.images.disk'))->put($originalsDir.'/delete-item.jpg', 'fake-data');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemImagesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->callTableAction(DeleteAction::class, $image)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_images', ['id' => $image->id]);
        $this->assertDatabaseMissing('available_images', ['id' => $image->id]);
        Storage::disk(config('localstorage.pictures.disk'))->assertMissing($picturesDir.'/delete-item.jpg');
        Storage::disk(config('localstorage.available.images.disk'))->assertMissing($originalsDir.'/delete-item.jpg');
    }

    public function test_item_images_view_action_url_points_to_admin_route(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $image = ItemImage::factory()->forItem($item)->create(['path' => 'view-url-item.jpg']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)
            ->test(ItemImagesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ]);

        $expectedViewUrl = route('filament.admin.item-image.view', [
            'item' => $item->id,
            'itemImage' => $image->id,
        ]);
        $expectedDownloadUrl = route('filament.admin.item-image.download', [
            'item' => $item->id,
            'itemImage' => $image->id,
        ]);

        $this->assertStringContainsString('/admin/', $expectedViewUrl);
        $this->assertStringContainsString('/admin/', $expectedDownloadUrl);
        $this->assertStringNotContainsString('/web/', $expectedViewUrl);
        $this->assertStringNotContainsString('/api/', $expectedViewUrl);

        $component->assertTableActionExists('view_image')
            ->assertTableActionExists('download');
    }

    public function test_item_images_attach_action_attaches_available_image(): void
    {
        Storage::fake('public');
        Storage::fake('local');

        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $availableImage = AvailableImage::factory()->create(['path' => 'attach-item.jpg']);

        $imagesDir = trim(config('localstorage.available.images.directory'), '/');
        Storage::disk(config('localstorage.available.images.disk'))->put($imagesDir.'/attach-item.jpg', 'fake-data');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemImagesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->mountTableAction('attach')
            ->setTableActionData([
                'available_image_id' => $availableImage->id,
                'alt_text' => 'Item alt text',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_images', [
            'item_id' => $item->id,
            'path' => 'attach-item.jpg',
            'alt_text' => 'Item alt text',
        ]);
        $this->assertDatabaseMissing('available_images', ['id' => $availableImage->id]);
    }

    // ─── Collection images ────────────────────────────────────────────────────

    public function test_collection_images_relation_manager_renders(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionImagesRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->assertSuccessful();
    }

    public function test_collection_images_delete_action_is_labelled_delete_permanently(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionImagesRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->assertTableActionExists('delete')
            ->assertTableActionHasLabel('delete', 'Delete permanently');
    }

    public function test_collection_images_detach_action_moves_image_to_available_pool(): void
    {
        Storage::fake('public');

        $user = $this->createCrudUser();
        $collection = Collection::factory()->create();
        $image = CollectionImage::factory()->forCollection($collection)->create(['path' => 'detach-col.jpg']);

        $picturesDir = trim(config('localstorage.pictures.directory'), '/');
        Storage::disk(config('localstorage.pictures.disk'))->put($picturesDir.'/detach-col.jpg', 'fake-data');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionImagesRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->callTableAction('detach', $image)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('collection_images', ['id' => $image->id]);
        $this->assertDatabaseHas('available_images', ['id' => $image->id]);
    }

    public function test_collection_images_delete_permanently_removes_image_without_returning_to_pool(): void
    {
        Storage::fake('public');
        Storage::fake('image-originals');

        $user = $this->createCrudUser();
        $collection = Collection::factory()->create();
        $image = CollectionImage::factory()->forCollection($collection)->create(['path' => 'delete-col.jpg']);

        $picturesDir = trim(config('localstorage.pictures.directory'), '/');
        Storage::disk(config('localstorage.pictures.disk'))->put($picturesDir.'/delete-col.jpg', 'fake-data');

        $originalsDir = trim(config('localstorage.available.images.directory'), '/');
        Storage::disk(config('localstorage.available.images.disk'))->put($originalsDir.'/delete-col.jpg', 'fake-data');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionImagesRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->callTableAction(DeleteAction::class, $image)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('collection_images', ['id' => $image->id]);
        $this->assertDatabaseMissing('available_images', ['id' => $image->id]);
        Storage::disk(config('localstorage.pictures.disk'))->assertMissing($picturesDir.'/delete-col.jpg');
        Storage::disk(config('localstorage.available.images.disk'))->assertMissing($originalsDir.'/delete-col.jpg');
    }

    public function test_collection_images_view_and_download_actions_exist(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionImagesRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->assertTableActionExists('view_image')
            ->assertTableActionExists('download');
    }

    // ─── Partner images ───────────────────────────────────────────────────────

    public function test_partner_images_relation_manager_renders(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerImagesRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->assertSuccessful();
    }

    public function test_partner_images_delete_action_is_labelled_delete_permanently(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerImagesRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->assertTableActionExists('delete')
            ->assertTableActionHasLabel('delete', 'Delete permanently');
    }

    public function test_partner_images_detach_action_moves_image_to_available_pool(): void
    {
        Storage::fake('public');

        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $image = PartnerImage::factory()->forPartner($partner)->create(['path' => 'detach-partner.jpg']);

        $picturesDir = trim(config('localstorage.pictures.directory'), '/');
        Storage::disk(config('localstorage.pictures.disk'))->put($picturesDir.'/detach-partner.jpg', 'fake-data');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerImagesRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->callTableAction('detach', $image)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('partner_images', ['id' => $image->id]);
        $this->assertDatabaseHas('available_images', ['id' => $image->id]);
    }

    public function test_partner_images_delete_permanently_removes_image_without_returning_to_pool(): void
    {
        Storage::fake('public');
        Storage::fake('image-originals');

        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $image = PartnerImage::factory()->forPartner($partner)->create(['path' => 'delete-partner.jpg']);

        $picturesDir = trim(config('localstorage.pictures.directory'), '/');
        Storage::disk(config('localstorage.pictures.disk'))->put($picturesDir.'/delete-partner.jpg', 'fake-data');

        $originalsDir = trim(config('localstorage.available.images.directory'), '/');
        Storage::disk(config('localstorage.available.images.disk'))->put($originalsDir.'/delete-partner.jpg', 'fake-data');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerImagesRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->callTableAction(DeleteAction::class, $image)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('partner_images', ['id' => $image->id]);
        $this->assertDatabaseMissing('available_images', ['id' => $image->id]);
        Storage::disk(config('localstorage.pictures.disk'))->assertMissing($picturesDir.'/delete-partner.jpg');
        Storage::disk(config('localstorage.available.images.disk'))->assertMissing($originalsDir.'/delete-partner.jpg');
    }

    public function test_partner_images_view_and_download_action_urls_are_admin_routes(): void
    {
        $partner = Partner::factory()->create();
        $image = PartnerImage::factory()->forPartner($partner)->create(['path' => 'url-partner.jpg']);

        $viewUrl = route('filament.admin.partner-image.view', [
            'partner' => $partner->id,
            'partnerImage' => $image->id,
        ]);
        $downloadUrl = route('filament.admin.partner-image.download', [
            'partner' => $partner->id,
            'partnerImage' => $image->id,
        ]);

        $this->assertStringContainsString('/admin/', $viewUrl);
        $this->assertStringContainsString('/admin/', $downloadUrl);
        $this->assertStringNotContainsString('/web/', $viewUrl);
        $this->assertStringNotContainsString('/api/', $viewUrl);
        $this->assertStringNotContainsString('/web/', $downloadUrl);
        $this->assertStringNotContainsString('/api/', $downloadUrl);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────
}
