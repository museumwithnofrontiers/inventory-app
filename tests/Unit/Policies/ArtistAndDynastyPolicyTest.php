<?php

namespace Tests\Unit\Policies;

use App\Mcp\ReadAuthorization;
use App\Models\Artist;
use App\Models\Dynasty;
use App\Policies\ArtistPolicy;
use App\Policies\DynastyPolicy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Artists and dynasties are shared data under the data rule (DataPolicy):
 * `view data` reads them, the data permissions change them.
 */
class ArtistAndDynastyPolicyTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    /**
     * @return array<string, array{class-string<Model>, class-string}>
     */
    public static function models(): array
    {
        return [
            'artist' => [Artist::class, ArtistPolicy::class],
            'dynasty' => [Dynasty::class, DynastyPolicy::class],
        ];
    }

    /**
     * @param  class-string<Model>  $model
     * @param  class-string  $policy
     */
    #[DataProvider('models')]
    public function test_it_is_the_models_policy(string $model, string $policy): void
    {
        $this->assertInstanceOf($policy, Gate::getPolicyFor($model));
    }

    /**
     * @param  class-string<Model>  $model
     */
    #[DataProvider('models')]
    public function test_a_reference_data_user_may_do_everything(string $model): void
    {
        $user = $this->createReferenceDataUser();
        $record = $model::factory()->create(); // @phpstan-ignore staticMethod.notFound

        $this->assertTrue($user->can('viewAny', $model));
        $this->assertTrue($user->can('view', $record));
        $this->assertTrue($user->can('create', $model));
        $this->assertTrue($user->can('update', $record));
        $this->assertTrue($user->can('delete', $record));
        $this->assertTrue($user->can('deleteAny', $model));
    }

    /**
     * @param  class-string<Model>  $model
     */
    #[DataProvider('models')]
    public function test_a_visitor_may_only_read(string $model): void
    {
        $record = $model::factory()->create(); // @phpstan-ignore staticMethod.notFound
        $user = $this->createViewOnlyUser();

        $this->assertTrue($user->can('viewAny', $model));
        $this->assertTrue($user->can('view', $record));
        $this->assertFalse($user->can('create', $model));
        $this->assertFalse($user->can('update', $record));
        $this->assertFalse($user->can('delete', $record));
        $this->assertFalse($user->can('deleteAny', $model));
    }

    /**
     * @param  class-string<Model>  $model
     */
    #[DataProvider('models')]
    public function test_the_mcp_read_rule_is_unchanged_for_data_users(string $model): void
    {
        $record = $model::factory()->create(); // @phpstan-ignore staticMethod.notFound
        $user = $this->createViewOnlyUser();

        $this->assertTrue(ReadAuthorization::mayViewAny($user, $model));
        $this->assertTrue(ReadAuthorization::mayView($user, $record));
    }

    /**
     * @param  class-string<Model>  $model
     */
    #[DataProvider('models')]
    public function test_a_user_with_neither_permission_may_do_nothing(string $model): void
    {
        $user = $this->createRoleManagerUser();
        $record = $model::factory()->create(); // @phpstan-ignore staticMethod.notFound

        $this->assertFalse($user->can('viewAny', $model));
        $this->assertFalse($user->can('view', $record));
        $this->assertFalse($user->can('update', $record));
    }
}
