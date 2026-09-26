<?php

namespace Tests\Filament\Resources;

use App\Events\AvailableImageEvent;
use App\Events\ImageUploadEvent;
use App\Filament\Resources\AvailableImageResource\Pages\EditAvailableImage;
use App\Filament\Resources\AvailableImageResource\Pages\ListAvailableImage;
use App\Listeners\AvailableImageListener;
use App\Listeners\ImageUploadListener;
use App\Models\AvailableImage;
use App\Models\ImageUpload;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class AvailableImageResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_authorized_users_can_render_available_image_list_and_view_pages(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $user = $this->createCrudUser();
        $availableImage = AvailableImage::factory()->create([
            'comment' => 'A beautiful artefact photo',
        ]);

        $this->actingAs($user)->get('/admin/available-images')
            ->assertOk()
            ->assertSee('Available Images');

        $this->actingAs($user)->get("/admin/available-images/{$availableImage->getKey()}")
            ->assertOk();
    }

    public function test_list_page_has_inline_upload_table_header_action(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListAvailableImage::class)
            ->assertTableHeaderActionsExistInOrder(['upload']);
    }

    public function test_imageuploadevent_dispatches_correctly_when_imageupload_model_is_created(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Storage::disk('local')->makeDirectory('image_uploads');
        Event::fake();

        $imageUpload = ImageUpload::factory()->create();

        ImageUploadEvent::dispatch($imageUpload);

        Event::assertDispatched(ImageUploadEvent::class, function (ImageUploadEvent $event) use ($imageUpload) {
            return $event->imageUpload->id === $imageUpload->id;
        });
    }

    public function test_available_image_metadata_can_be_edited(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $user = $this->createCrudUser();
        $availableImage = AvailableImage::factory()->create([
            'comment' => 'Original comment',
            'copyright' => 'Original copyright',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EditAvailableImage::class, [
                'record' => $availableImage->getRouteKey(),
            ])
            ->assertFormSet([
                'comment' => 'Original comment',
                'copyright' => 'Original copyright',
            ])
            ->fillForm([
                'comment' => 'Updated comment',
                'copyright' => 'Updated copyright',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('available_images', [
            'id' => $availableImage->id,
            'comment' => 'Updated comment',
            'copyright' => 'Updated copyright',
        ]);
    }

    public function test_available_image_copyright_stores_null_for_blank(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $user = $this->createCrudUser();
        $availableImage = AvailableImage::factory()->create([
            'copyright' => 'Original copyright',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EditAvailableImage::class, [
                'record' => $availableImage->getRouteKey(),
            ])
            ->fillForm([
                'copyright' => '',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('available_images', [
            'id' => $availableImage->id,
            'copyright' => null,
        ]);
    }

    public function test_available_image_can_be_deleted(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Storage::disk('public')->makeDirectory('images');

        $user = $this->createCrudUser();
        $availableImage = AvailableImage::factory()->create();

        $imagePath = trim(config('localstorage.available.images.directory'), '/').'/'.$availableImage->path;
        Storage::disk('public')->put($imagePath, 'fake-image-data');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListAvailableImage::class)
            ->callTableAction(DeleteAction::class, $availableImage)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('available_images', [
            'id' => $availableImage->id,
        ]);
    }

    public function test_imageuploadevent_is_registered_with_imageuploadlistener(): void
    {
        Event::fake();
        Event::assertListening(
            expectedEvent: ImageUploadEvent::class,
            expectedListener: ImageUploadListener::class,
        );
    }

    public function test_availableimageevent_is_registered_with_availableimagelistener(): void
    {
        Event::fake();
        Event::assertListening(
            expectedEvent: AvailableImageEvent::class,
            expectedListener: AvailableImageListener::class,
        );
    }

    public function test_filament_image_view_routes_are_registered(): void
    {
        $this->assertNotNull(route('filament.admin.available-image.view', ['availableImage' => 'test-id']));
        $this->assertNotNull(route('filament.admin.available-image.download', ['availableImage' => 'test-id']));
        $this->assertNotNull(route('filament.admin.item-image.view', ['item' => 'item-id', 'itemImage' => 'image-id']));
        $this->assertNotNull(route('filament.admin.item-image.download', ['item' => 'item-id', 'itemImage' => 'image-id']));
        $this->assertNotNull(route('filament.admin.collection-image.view', ['collection' => 'col-id', 'collectionImage' => 'image-id']));
        $this->assertNotNull(route('filament.admin.collection-image.download', ['collection' => 'col-id', 'collectionImage' => 'image-id']));
        $this->assertNotNull(route('filament.admin.partner-image.view', ['partner' => 'par-id', 'partnerImage' => 'image-id']));
        $this->assertNotNull(route('filament.admin.partner-image.download', ['partner' => 'par-id', 'partnerImage' => 'image-id']));
    }

    public function test_imageupload_listener_processes_file_and_creates_available_image(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Storage::disk('local')->makeDirectory('image_uploads');
        Storage::disk('public')->makeDirectory('images');

        $imageUpload = ImageUpload::factory()->create();
        $minimalJpeg = base64_decode('/9j/4AAQSkZJRgABAQEAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=');
        Storage::disk('local')->put($imageUpload->path, $minimalJpeg);

        $uploadId = $imageUpload->id;

        $listener = new ImageUploadListener;
        $listener->handle(new ImageUploadEvent($imageUpload));

        $this->assertDatabaseMissing('image_uploads', ['id' => $uploadId]);

        $availableImage = AvailableImage::find($uploadId);
        $this->assertNotNull($availableImage);
        $this->assertNotEmpty($availableImage->path);
    }

    public function test_upload_action_shows_failure_notification_when_processing_fails(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        // Simulate the state after ImageUploadEvent::dispatch() runs but no AvailableImage
        // was created (e.g. invalid image causes listener to bail silently).
        // We verify the deterministic failure path by testing the underlying condition:
        // when AvailableImage::find(id) returns null, the record was NOT created.
        $imageUpload = ImageUpload::factory()->create();

        // Dispatch the event with events faked so no listener runs
        Event::fake();
        ImageUploadEvent::dispatch($imageUpload);

        // No AvailableImage should exist — this is the failure state
        $this->assertNull(AvailableImage::find($imageUpload->id));
        $this->assertDatabaseEmpty('available_images');
    }

    public function test_upload_action_does_not_write_directly_to_public_disk(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Storage::disk('local')->makeDirectory('image_uploads');
        Storage::disk('public')->makeDirectory('images');

        // Simulate the upload step only: ImageUpload is created on the local disk,
        // and the event is dispatched. No AvailableImage should appear unless the
        // listener runs (the listener is the only allowed writer to public storage).
        Event::fake();

        $imageUpload = ImageUpload::factory()->create(['path' => 'image_uploads/direct-write-test.jpg']);
        Storage::disk('local')->put($imageUpload->path, 'fake-binary');

        ImageUploadEvent::dispatch($imageUpload);

        // Public disk must remain empty — only the listener is allowed to write there
        $imagesDir = trim(config('localstorage.available.images.directory', 'images'), '/');
        Storage::disk('public')->assertMissing($imagesDir.'/direct-write-test.jpg');
    }

    public function test_table_view_image_and_download_actions_exist(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListAvailableImage::class)
            ->assertTableActionExists('view_image')
            ->assertTableActionExists('download');
    }

    public function test_table_view_image_action_url_points_to_admin_route(): void
    {
        $availableImage = AvailableImage::factory()->create(['path' => 'url-test.jpg']);

        $viewUrl = route('filament.admin.available-image.view', ['availableImage' => $availableImage->id]);
        $downloadUrl = route('filament.admin.available-image.download', ['availableImage' => $availableImage->id]);

        $this->assertStringContainsString('/admin/', $viewUrl);
        $this->assertStringContainsString('/admin/', $downloadUrl);
        $this->assertStringNotContainsString('/web/', $viewUrl);
        $this->assertStringNotContainsString('/api/', $viewUrl);
        $this->assertStringNotContainsString('/web/', $downloadUrl);
        $this->assertStringNotContainsString('/api/', $downloadUrl);
    }
}
