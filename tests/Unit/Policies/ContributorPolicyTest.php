<?php

namespace Tests\Unit\Policies;

use App\Models\Collection;
use App\Models\Contributor;
use App\Models\User;
use App\Policies\ContributorPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * A contributor is authorized through its collection (M16 I5, #2648): the
 * policy only delegates to CollectionPolicy.
 */
class ContributorPolicyTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_it_is_the_policy_of_contributors(): void
    {
        $this->assertInstanceOf(ContributorPolicy::class, Gate::getPolicyFor(Contributor::class));
    }

    public function test_a_crud_user_may_do_everything_its_collection_allows(): void
    {
        $user = $this->createCrudUser();
        $contributor = Contributor::factory()->create();

        $this->assertTrue($user->can('viewAny', Contributor::class));
        $this->assertTrue($user->can('view', $contributor));
        $this->assertTrue($user->can('create', Contributor::class));
        $this->assertTrue($user->can('create', [Contributor::class, $contributor->collection]));
        $this->assertTrue($user->can('update', $contributor));
        $this->assertTrue($user->can('delete', $contributor));
        $this->assertTrue($user->can('deleteAny', Contributor::class));
    }

    public function test_a_view_only_user_may_only_view(): void
    {
        $user = $this->createViewOnlyUser();
        $contributor = Contributor::factory()->create();

        $this->assertTrue($user->can('viewAny', Contributor::class));
        $this->assertTrue($user->can('view', $contributor));
        $this->assertFalse($user->can('create', Contributor::class));
        $this->assertFalse($user->can('create', [Contributor::class, $contributor->collection]));
        $this->assertFalse($user->can('update', $contributor));
        $this->assertFalse($user->can('delete', $contributor));
        $this->assertFalse($user->can('deleteAny', Contributor::class));
    }

    public function test_each_answer_is_the_collections(): void
    {
        $contributor = Contributor::factory()->create();
        $collection = $contributor->collection;
        $this->assertInstanceOf(Collection::class, $collection);

        foreach ([$this->createCrudUser(), $this->createViewOnlyUser(), User::factory()->create()] as $user) {
            $this->assertSame($user->can('view', $collection), $user->can('view', $contributor));
            $this->assertSame($user->can('update', $collection), $user->can('update', $contributor));
            $this->assertSame($user->can('update', $collection), $user->can('delete', $contributor));
        }
    }
}
