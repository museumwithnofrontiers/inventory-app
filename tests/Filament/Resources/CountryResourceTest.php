<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\CountryResource\Pages\CreateCountry;
use App\Filament\Resources\CountryResource\Pages\EditCountry;
use App\Filament\Resources\CountryResource\Pages\ListCountry;
use App\Models\Country;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class CountryResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_authorized_users_can_render_all_country_resource_pages(): void
    {
        $user = $this->createReferenceDataUser();
        $country = Country::factory()->create(['id' => 'jor', 'internal_name' => 'Jordan']);

        $this->actingAs($user)->get('/admin/countries')
            ->assertOk()
            ->assertSee('Countries');

        $this->actingAs($user)->get('/admin/countries/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/countries/{$country->getKey()}/edit")
            ->assertOk()
            ->assertSee('Jordan');

        $this->actingAs($user)->get("/admin/countries/{$country->getKey()}")
            ->assertOk()
            ->assertSee('Jordan')
            ->assertSee('jor');
    }

    public function test_authorized_users_can_create_edit_and_delete_countries(): void
    {
        $user = $this->createReferenceDataUser();
        $country = Country::factory()->create([
            'id' => 'jor',
            'internal_name' => 'Jordan',
            'backward_compatibility' => 'jo',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateCountry::class)
            ->fillForm([
                'id' => 'egy',
                'internal_name' => 'Egypt',
                'backward_compatibility' => 'eg',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('countries', [
            'id' => 'egy',
            'internal_name' => 'Egypt',
            'backward_compatibility' => 'eg',
        ]);

        Livewire::actingAs($user)
            ->test(EditCountry::class, [
                'record' => $country->getRouteKey(),
            ])
            ->assertFormSet([
                'id' => 'jor',
                'internal_name' => 'Jordan',
                'backward_compatibility' => 'jo',
            ])
            ->fillForm([
                'internal_name' => 'Hashemite Kingdom of Jordan',
                'backward_compatibility' => 'jd',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('countries', [
            'id' => 'jor',
            'internal_name' => 'Hashemite Kingdom of Jordan',
            'backward_compatibility' => 'jd',
        ]);

        Livewire::actingAs($user)
            ->test(ListCountry::class)
            ->callTableAction(DeleteAction::class, $country)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('countries', [
            'id' => 'jor',
        ]);
    }
}
