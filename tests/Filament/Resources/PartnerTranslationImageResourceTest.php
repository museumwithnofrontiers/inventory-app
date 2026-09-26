<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\PartnerTranslationResource\Pages\EditPartnerTranslation;
use App\Filament\Resources\PartnerTranslationResource\RelationManagers\ImagesRelationManager;
use App\Models\AvailableImage;
use App\Models\Context;
use App\Models\Language;
use App\Models\Partner;
use App\Models\PartnerTranslation;
use App\Models\PartnerTranslationImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class PartnerTranslationImageResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ─── Images relation manager ──────────────────────────────────────────────

    public function test_images_relation_manager_renders_on_edit_page(): void
    {
        $user = $this->createCrudUser();
        $partnerTranslation = $this->makePartnerTranslation();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ImagesRelationManager::class, [
                'ownerRecord' => $partnerTranslation,
                'pageClass' => EditPartnerTranslation::class,
            ])
            ->assertSuccessful();
    }

    public function test_images_relation_manager_lists_attached_images(): void
    {
        $user = $this->createCrudUser();
        $partnerTranslation = $this->makePartnerTranslation();
        $image = PartnerTranslationImage::factory()
            ->forPartnerTranslation($partnerTranslation)
            ->create(['path' => 'test-img.jpg']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ImagesRelationManager::class, [
                'ownerRecord' => $partnerTranslation,
                'pageClass' => EditPartnerTranslation::class,
            ])
            ->assertCanSeeTableRecords([$image]);
    }

    public function test_attach_action_attaches_available_image(): void
    {
        Storage::fake('public');
        Storage::fake('local');

        $user = $this->createCrudUser();
        $partnerTranslation = $this->makePartnerTranslation();

        $availableImage = AvailableImage::factory()->create(['path' => 'avail.jpg', 'comment' => 'A nice image']);
        $imagesDir = trim(config('localstorage.available.images.directory'), '/');
        Storage::disk(config('localstorage.available.images.disk'))->put($imagesDir.'/avail.jpg', 'fake-data');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ImagesRelationManager::class, [
                'ownerRecord' => $partnerTranslation,
                'pageClass' => EditPartnerTranslation::class,
            ])
            ->mountTableAction('attach')
            ->setTableActionData([
                'available_image_id' => $availableImage->id,
                'alt_text' => 'My alt text',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('partner_translation_images', [
            'partner_translation_id' => $partnerTranslation->id,
            'path' => 'avail.jpg',
            'alt_text' => 'My alt text',
        ]);

        $this->assertDatabaseMissing('available_images', ['id' => $availableImage->id]);
    }

    public function test_detach_action_moves_image_back_to_available_pool(): void
    {
        Storage::fake('public');
        Storage::fake('local');

        $user = $this->createCrudUser();
        $partnerTranslation = $this->makePartnerTranslation();
        $image = PartnerTranslationImage::factory()
            ->forPartnerTranslation($partnerTranslation)
            ->create(['path' => 'detach-test.jpg', 'alt_text' => 'Detach me']);

        $picturesDir = trim(config('localstorage.pictures.directory'), '/');
        Storage::disk(config('localstorage.pictures.disk'))->put($picturesDir.'/detach-test.jpg', 'fake-data');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ImagesRelationManager::class, [
                'ownerRecord' => $partnerTranslation,
                'pageClass' => EditPartnerTranslation::class,
            ])
            ->callTableAction('detach', $image)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('partner_translation_images', ['id' => $image->id]);
        $this->assertDatabaseHas('available_images', ['id' => $image->id]);
    }

    public function test_edit_action_updates_alt_text_and_display_order(): void
    {
        $user = $this->createCrudUser();
        $partnerTranslation = $this->makePartnerTranslation();
        $image = PartnerTranslationImage::factory()
            ->forPartnerTranslation($partnerTranslation)
            ->create(['alt_text' => 'Old alt text', 'display_order' => 1]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ImagesRelationManager::class, [
                'ownerRecord' => $partnerTranslation,
                'pageClass' => EditPartnerTranslation::class,
            ])
            ->mountTableAction('edit', $image)
            ->setTableActionData([
                'alt_text' => 'Updated alt text',
                'display_order' => 5,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('partner_translation_images', [
            'id' => $image->id,
            'alt_text' => 'Updated alt text',
            'display_order' => 5,
        ]);
    }

    public function test_delete_action_permanently_removes_image(): void
    {
        Storage::fake('public');

        $user = $this->createCrudUser();
        $partnerTranslation = $this->makePartnerTranslation();
        $image = PartnerTranslationImage::factory()
            ->forPartnerTranslation($partnerTranslation)
            ->create(['path' => 'delete-test.jpg']);

        $picturesDir = trim(config('localstorage.pictures.directory'), '/');
        Storage::disk(config('localstorage.pictures.disk'))->put($picturesDir.'/delete-test.jpg', 'fake-data');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ImagesRelationManager::class, [
                'ownerRecord' => $partnerTranslation,
                'pageClass' => EditPartnerTranslation::class,
            ])
            ->callTableAction('delete', $image)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('partner_translation_images', ['id' => $image->id]);
        $this->assertDatabaseMissing('available_images', ['id' => $image->id]);
    }

    // ─── Filament image routes ─────────────────────────────────────────────────

    public function test_filament_partner_translation_image_view_route_returns_image_inline(): void
    {
        $disk = config('localstorage.available.images.disk');
        Storage::fake($disk);
        Storage::disk($disk)->makeDirectory('images');

        $partnerTranslation = $this->makePartnerTranslation();
        $image = PartnerTranslationImage::factory()
            ->forPartnerTranslation($partnerTranslation)
            ->create(['path' => 'pt-view-test.jpg']);

        $imagesDir = trim(config('localstorage.available.images.directory'), '/');
        Storage::disk($disk)->put($imagesDir.'/'.$image->path, 'fake-jpeg-data');

        $user = $this->createViewOnlyUser();

        $response = $this->actingAs($user)->get(
            route('filament.admin.partner-translation-image.view', [
                'partnerTranslation' => $partnerTranslation,
                'partnerTranslationImage' => $image,
            ])
        );

        $response->assertOk();
        $this->assertStringNotContainsString('attachment', $response->headers->get('Content-Disposition') ?? '');
    }

    public function test_filament_partner_translation_image_download_route_returns_attachment(): void
    {
        $disk = config('localstorage.available.images.disk');
        Storage::fake($disk);
        Storage::disk($disk)->makeDirectory('images');

        $partnerTranslation = $this->makePartnerTranslation();
        $image = PartnerTranslationImage::factory()
            ->forPartnerTranslation($partnerTranslation)
            ->create(['path' => 'pt-download-test.jpg']);

        $imagesDir = trim(config('localstorage.available.images.directory'), '/');
        Storage::disk($disk)->put($imagesDir.'/'.$image->path, 'fake-jpeg-data');

        $user = $this->createViewOnlyUser();

        $response = $this->actingAs($user)->get(
            route('filament.admin.partner-translation-image.download', [
                'partnerTranslation' => $partnerTranslation,
                'partnerTranslationImage' => $image,
            ])
        );

        $response->assertOk();
        $this->assertStringContainsString('attachment', $response->headers->get('Content-Disposition') ?? '');
    }

    public function test_filament_partner_translation_image_view_route_returns_404_for_mismatched_translation(): void
    {
        Storage::fake('public');

        $translation1 = $this->makePartnerTranslation();
        $translation2 = $this->makePartnerTranslation();
        $image = PartnerTranslationImage::factory()
            ->forPartnerTranslation($translation1)
            ->create(['path' => 'pt-mismatch.jpg']);

        $user = $this->createViewOnlyUser();

        $this->actingAs($user)->get(
            route('filament.admin.partner-translation-image.view', [
                'partnerTranslation' => $translation2,
                'partnerTranslationImage' => $image,
            ])
        )->assertNotFound();
    }

    public function test_unauthenticated_users_cannot_access_partner_translation_image_routes(): void
    {
        Storage::fake('public');

        $partnerTranslation = $this->makePartnerTranslation();
        $image = PartnerTranslationImage::factory()
            ->forPartnerTranslation($partnerTranslation)
            ->create(['path' => 'pt-auth-test.jpg']);

        $this->get(
            route('filament.admin.partner-translation-image.view', [
                'partnerTranslation' => $partnerTranslation,
                'partnerTranslationImage' => $image,
            ])
        )->assertRedirect('/admin/login');
    }

    public function test_partner_translation_image_routes_are_not_web_or_api_routes(): void
    {
        $viewRoute = route('filament.admin.partner-translation-image.view', [
            'partnerTranslation' => 'fake-id',
            'partnerTranslationImage' => 'fake-id',
        ]);
        $downloadRoute = route('filament.admin.partner-translation-image.download', [
            'partnerTranslation' => 'fake-id',
            'partnerTranslationImage' => 'fake-id',
        ]);

        $this->assertStringContainsString('/admin/', $viewRoute);
        $this->assertStringContainsString('/admin/', $downloadRoute);
        $this->assertStringNotContainsString('/web/', $viewRoute);
        $this->assertStringNotContainsString('/api/', $viewRoute);
        $this->assertStringNotContainsString('/web/', $downloadRoute);
        $this->assertStringNotContainsString('/api/', $downloadRoute);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function makePartnerTranslation(): PartnerTranslation
    {
        $partner = Partner::factory()->create();
        $language = Language::factory()->create();
        $context = Context::factory()->create();

        return PartnerTranslation::factory()->create([
            'partner_id' => $partner->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Test Translation',
        ]);
    }
}
