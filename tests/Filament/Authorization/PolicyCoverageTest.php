<?php

namespace Tests\Filament\Authorization;

use App\Enums\Role;
use App\Filament\Resources\AvailableImageResource\Pages\EditAvailableImage;
use App\Filament\Resources\AvailableImageResource\Pages\ListAvailableImage;
use App\Filament\Resources\CollectionResource\Pages\ListCollection;
use App\Filament\Resources\ItemResource\Pages\ListItem;
use App\Models\AvailableImage;
use App\Models\Collection;
use App\Models\Item;
use App\Models\User;
use App\Support\Authorization\UserRoles;
use Filament\Facades\Filament;
use Filament\Resources\Resource;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Gate;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * The policies are the only authorization mechanism in the panel: every
 * model has one, every resource's visibility is its policy's viewAny, a
 * missing policy denies, and a Visitor runs no action that changes data.
 */
class PolicyCoverageTest extends TestCase
{
    use RefreshDatabase;

    private function userWith(?Role $role): User
    {
        $user = User::factory()->create();

        if ($role !== null) {
            app(UserRoles::class)->assign($user, $role);
        }

        return $user->fresh() ?? $user;
    }

    public function test_every_model_has_a_policy(): void
    {
        $missing = [];

        foreach (File::files(app_path('Models')) as $file) {
            $class = 'App\\Models\\'.$file->getFilenameWithoutExtension();

            if ($class === 'App\\Models\\Setting' || ! is_subclass_of($class, Model::class)) {
                continue;
            }

            if (Gate::getPolicyFor($class) === null) {
                $missing[] = $class;
            }
        }

        $this->assertSame([], $missing, 'Models without a policy: '.implode(', ', $missing));
    }

    public function test_a_resource_is_visible_exactly_when_its_policy_allows_view_any(): void
    {
        Filament::setCurrentPanel(Filament::getPanel('admin'));

        foreach ([null, ...Role::cases()] as $role) {
            $user = $this->userWith($role);

            $this->actingAs($user);

            foreach (Filament::getPanel('admin')->getResources() as $resource) {
                /** @var class-string<resource> $resource */
                $this->assertSame(
                    Gate::forUser($user)->allows('viewAny', $resource::getModel()),
                    $resource::canViewAny(),
                    $resource.' for '.($role->value ?? 'no role'),
                );
            }
        }
    }

    public function test_a_missing_policy_denies_in_filament(): void
    {
        $this->actingAs($this->userWith(Role::DATA_MANAGER));

        $this->assertFalse(Gate::allows('update', new class extends Model {}));
        $this->assertFalse(Resource::shouldCheckPolicyExistence());
    }

    public function test_a_visitor_runs_none_of_the_item_and_collection_actions_that_change_data(): void
    {
        Filament::setCurrentPanel(Filament::getPanel('admin'));
        $visitor = $this->userWith(Role::VISITOR);
        $item = Item::factory()->Object()->create();
        $collection = Collection::factory()->create();

        Livewire::actingAs($visitor)
            ->test(ListItem::class)
            ->assertTableActionHidden('changeParent', $item)
            ->assertTableBulkActionHidden('moveToParent')
            ->assertTableBulkActionHidden('attachToCollection')
            ->assertTableBulkActionHidden('attachTag');

        Livewire::actingAs($visitor)
            ->test(ListCollection::class)
            ->assertTableActionHidden('changeParent', $collection)
            ->assertTableBulkActionHidden('moveToParent');
    }

    public function test_the_manager_of_data_sees_them(): void
    {
        Filament::setCurrentPanel(Filament::getPanel('admin'));
        $item = Item::factory()->Object()->create();

        Livewire::actingAs($this->userWith(Role::DATA_MANAGER))
            ->test(ListItem::class)
            ->assertTableActionVisible('changeParent', $item)
            ->assertTableBulkActionVisible('attachTag');
    }

    public function test_a_visitor_cannot_upload_edit_or_delete_available_images(): void
    {
        Filament::setCurrentPanel(Filament::getPanel('admin'));
        $visitor = $this->userWith(Role::VISITOR);
        $image = AvailableImage::factory()->create();

        Livewire::actingAs($visitor)
            ->test(ListAvailableImage::class)
            ->assertTableActionHidden('upload')
            ->assertTableActionHidden('edit', $image)
            ->assertTableActionHidden('delete', $image);

        $this->actingAs($visitor)->get(EditAvailableImage::getUrl(['record' => $image]))->assertForbidden();
    }

    public function test_a_user_manager_cannot_fetch_an_original_image(): void
    {
        $image = AvailableImage::factory()->create();

        $this->actingAs($this->userWith(Role::USER_MANAGER))
            ->get(route('filament.admin.available-image.view', ['availableImage' => $image->id]))
            ->assertForbidden();
    }
}
