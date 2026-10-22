<?php

namespace Tests\Api\Mcp;

use App\Mcp\EntityRegistry;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Every inventory entity the API serves is browsable through the MCP
 * server, unless deliberately left out.
 */
class EntityRegistryTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_registered_type_has_a_model_a_resource_and_a_table(): void
    {
        foreach (EntityRegistry::types() as $type) {
            $this->assertTrue(class_exists(EntityRegistry::model($type)), "{$type}: no model");
            $this->assertTrue(class_exists(EntityRegistry::resource($type)), "{$type}: no resource");
            $this->assertTrue(Schema::hasTable(EntityRegistry::table($type)), "{$type}: no table");
        }
    }

    public function test_every_model_with_an_api_resource_is_registered_or_excluded(): void
    {
        $missing = [];

        foreach (glob(app_path('Http/Resources/*Resource.php')) ?: [] as $file) {
            $model = 'App\\Models\\'.substr(basename($file, '.php'), 0, -strlen('Resource'));

            if (! class_exists($model) || ! is_subclass_of($model, Model::class) || $model === User::class) {
                continue;
            }

            if (EntityRegistry::typeOf(new $model) === null && ! array_key_exists($model, EntityRegistry::EXCLUDED)) {
                $missing[] = $model;
            }
        }

        $this->assertSame([], $missing, 'Register these in App\Mcp\EntityRegistry, or list them in EXCLUDED with a reason');
    }

    public function test_search_columns_exist_on_the_table(): void
    {
        foreach (EntityRegistry::types() as $type) {
            foreach (EntityRegistry::searchColumns($type) as $column) {
                $this->assertContains($column, EntityRegistry::columns($type), "{$type}.{$column}");
            }
        }
    }
}
