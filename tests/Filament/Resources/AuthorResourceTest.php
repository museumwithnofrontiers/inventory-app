<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\AuthorResource\Pages\CreateAuthor;
use App\Filament\Resources\AuthorResource\Pages\EditAuthor;
use App\Filament\Resources\AuthorResource\Pages\ListAuthor;
use App\Models\Author;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class AuthorResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_authorized_users_can_render_all_author_resource_pages(): void
    {
        $user = $this->createReferenceDataUser();
        $author = Author::factory()->create([
            'name' => 'Jane Doe',
            'internal_name' => 'jane-doe',
        ]);

        $this->actingAs($user)->get('/admin/authors')
            ->assertOk()
            ->assertSee('Authors');

        $this->actingAs($user)->get('/admin/authors/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/authors/{$author->getKey()}/edit")
            ->assertOk()
            ->assertSee('Jane Doe');

        $this->actingAs($user)->get("/admin/authors/{$author->getKey()}")
            ->assertOk()
            ->assertSee('Jane Doe')
            ->assertSee('jane-doe');
    }

    public function test_authorized_users_can_create_edit_and_delete_authors(): void
    {
        $user = $this->createReferenceDataUser();
        $author = Author::factory()->create([
            'name' => 'Jane Doe',
            'internal_name' => 'jane-doe',
            'backward_compatibility' => 'legacy-jane',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateAuthor::class)
            ->fillForm([
                'name' => 'John Smith',
                'internal_name' => 'john-smith',
                'backward_compatibility' => 'legacy-john',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('authors', [
            'name' => 'John Smith',
            'internal_name' => 'john-smith',
            'backward_compatibility' => 'legacy-john',
        ]);

        Livewire::actingAs($user)
            ->test(EditAuthor::class, [
                'record' => $author->getRouteKey(),
            ])
            ->assertFormSet([
                'name' => 'Jane Doe',
                'internal_name' => 'jane-doe',
                'backward_compatibility' => 'legacy-jane',
            ])
            ->fillForm([
                'name' => 'Jane Smith',
                'internal_name' => 'jane-smith',
                'backward_compatibility' => 'legacy-jane-2',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('authors', [
            'id' => $author->id,
            'name' => 'Jane Smith',
            'internal_name' => 'jane-smith',
            'backward_compatibility' => 'legacy-jane-2',
        ]);

        Livewire::actingAs($user)
            ->test(ListAuthor::class)
            ->callTableAction(DeleteAction::class, $author)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('authors', [
            'id' => $author->id,
        ]);
    }
}
