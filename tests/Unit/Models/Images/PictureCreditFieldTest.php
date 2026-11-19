<?php

namespace Tests\Unit\Models\Images;

use App\Contracts\DetachableImage;
use App\Models\AvailableImage;
use App\Support\Images\AttachedImageRegistry;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * M16 F1 (#2651): `photographer` and `credit` sit next to `copyright` on every
 * image model, and the attach/detach row swaps carry them like `copyright`.
 */
class PictureCreditFieldTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return list<list<class-string<Model>>>
     */
    public static function imageModelProvider(): array
    {
        return array_map(
            fn (string $class): array => [$class],
            [AvailableImage::class, ...AttachedImageRegistry::modelClasses()]
        );
    }

    /**
     * @return list<list<class-string<Model&DetachableImage>>>
     */
    public static function detachableModelProvider(): array
    {
        $detachable = array_filter(
            AttachedImageRegistry::modelClasses(),
            fn (string $class): bool => is_subclass_of($class, DetachableImage::class)
        );

        /** @var list<list<class-string<Model&DetachableImage>>> */
        return array_values(array_map(fn (string $class): array => [$class], $detachable));
    }

    public function test_every_registry_table_has_both_columns(): void
    {
        foreach (['available_images', ...AttachedImageRegistry::tableNames()] as $table) {
            $this->assertTrue(
                Schema::hasColumns($table, ['photographer', 'credit']),
                "{$table} lacks photographer or credit"
            );
        }
    }

    #[DataProvider('imageModelProvider')]
    public function test_photographer_and_credit_persist_and_default_to_null(string $class): void
    {
        $instance = new $class;
        $this->assertContains('photographer', $instance->getFillable());
        $this->assertContains('credit', $instance->getFillable());

        /** @var Model $record */
        $record = $class::factory()->create();
        $this->assertNull($record->fresh()?->getAttribute('photographer'));
        $this->assertNull($record->fresh()?->getAttribute('credit'));

        $record->forceFill(['photographer' => 'Ana Photographer', 'credit' => 'Wikimedia Commons'])->save();

        $this->assertSame('Ana Photographer', $record->fresh()?->getAttribute('photographer'));
        $this->assertSame('Wikimedia Commons', $record->fresh()?->getAttribute('credit'));
    }

    #[DataProvider('detachableModelProvider')]
    public function test_detach_and_attach_carry_photographer_and_credit(string $class): void
    {
        Storage::fake('local');
        Storage::fake('public');

        /** @var Model&DetachableImage $record */
        $record = $class::factory()->create([
            'copyright' => null,
            'photographer' => 'Ana Photographer',
            'credit' => 'Wikimedia Commons',
        ]);
        $id = $record->getKey();
        // The owner's key is the first fillable attribute of every *Image model.
        $ownerKey = $record->getFillable()[0];
        $this->assertStringEndsWith('_id', $ownerKey);
        $owner = $record->getAttribute($ownerKey);
        $this->assertIsString($owner);
        Storage::disk(Config::string('localstorage.available.images.disk'))->put(
            trim(Config::string('localstorage.available.images.directory'), '/').'/'.$record->getAttribute('path'),
            'fake-image-data'
        );

        $available = $record->detachToAvailableImage();

        $this->assertSame($id, $available->id);
        $this->assertSame('Ana Photographer', $available->photographer);
        $this->assertSame('Wikimedia Commons', $available->credit);
        $this->assertNull($available->copyright);

        $attached = $class::attachFromAvailableImage($available, $owner);

        $this->assertSame($id, $attached->getKey());
        $this->assertSame('Ana Photographer', $attached->getAttribute('photographer'));
        $this->assertSame('Wikimedia Commons', $attached->getAttribute('credit'));
        $this->assertDatabaseMissing('available_images', ['id' => $id]);
    }
}
