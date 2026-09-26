<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\ContextResource\Pages\CreateContext;
use App\Filament\Resources\ContextResource\Pages\EditContext;
use App\Filament\Resources\ContextResource\Pages\ListContext;
use App\Models\Context;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class ContextResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_authorized_users_can_render_all_context_resource_pages(): void
    {
        $user = $this->createReferenceDataUser();
        $context = Context::factory()->withIsDefault()->create(['internal_name' => 'Catalogue']);

        $this->actingAs($user)->get('/admin/contexts')
            ->assertOk()
            ->assertSee('Contexts');

        $this->actingAs($user)->get('/admin/contexts/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/contexts/{$context->getKey()}/edit")
            ->assertOk()
            ->assertSee('Catalogue');

        $this->actingAs($user)->get("/admin/contexts/{$context->getKey()}")
            ->assertOk()
            ->assertSee('Catalogue');
    }

    public function test_authorized_users_can_create_edit_and_delete_contexts(): void
    {
        $user = $this->createReferenceDataUser();
        $context = Context::factory()->create([
            'internal_name' => 'Catalogue',
            'backward_compatibility' => 'ctx-01',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateContext::class)
            ->fillForm([
                'internal_name' => 'Exhibition',
                'backward_compatibility' => 'ctx-02',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('contexts', [
            'internal_name' => 'Exhibition',
            'backward_compatibility' => 'ctx-02',
        ]);

        Livewire::actingAs($user)
            ->test(EditContext::class, [
                'record' => $context->getRouteKey(),
            ])
            ->assertFormSet([
                'internal_name' => 'Catalogue',
                'backward_compatibility' => 'ctx-01',
            ])
            ->fillForm([
                'internal_name' => 'Collection catalogue',
                'backward_compatibility' => 'ctx-11',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('contexts', [
            'id' => $context->id,
            'internal_name' => 'Collection catalogue',
            'backward_compatibility' => 'ctx-11',
        ]);

        Livewire::actingAs($user)
            ->test(ListContext::class)
            ->callTableAction(DeleteAction::class, $context)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('contexts', [
            'id' => $context->id,
        ]);
    }

    public function test_context_resource_filters_by_default_status_and_sets_the_default_context(): void
    {
        $user = $this->createReferenceDataUser();
        $defaultContext = Context::factory()->withIsDefault()->create(['internal_name' => 'Catalogue']);
        $exhibition = Context::factory()->create([
            'internal_name' => 'Exhibition',
            'is_default' => false,
        ]);
        $archive = Context::factory()->create([
            'internal_name' => 'Archive',
            'is_default' => false,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListContext::class)
            ->filterTable('is_default', true)
            ->assertCanSeeTableRecords([$defaultContext])
            ->assertCanNotSeeTableRecords([$exhibition, $archive]);

        Livewire::actingAs($user)
            ->test(ListContext::class)
            ->callTableBulkAction('setDefault', [$exhibition])
            ->assertNotified('Default context updated');

        $this->assertTrue($exhibition->fresh()->is_default);
        $this->assertFalse($defaultContext->fresh()->is_default);

        Livewire::actingAs($user)
            ->test(ListContext::class)
            ->callTableBulkAction('setDefault', [$exhibition, $archive])
            ->assertNotified('Select exactly one context');

        $this->assertTrue($exhibition->fresh()->is_default);
        $this->assertFalse($archive->fresh()->is_default);
    }
}
