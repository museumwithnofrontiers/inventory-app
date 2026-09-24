<?php

namespace App\Support\Images;

use App\Contracts\HasCopyright;
use App\Contracts\StreamableImageFile;
use App\Models\CollectionImage;
use App\Models\ContributorImage;
use App\Models\ItemImage;
use App\Models\PartnerImage;
use App\Models\PartnerLogo;
use App\Models\PartnerTranslationImage;
use App\Models\TimelineEventImage;
use App\Traits\DeletesImageFilesOnDelete;
use Illuminate\Database\Eloquent\Model;

class AttachedImageRegistry
{
    /**
     * All model classes that own an attached image: a pristine private
     * original under localstorage.available.images, served at /pub/{path} -
     * burned, with its rendition cached under localstorage.pictures, unless
     * the model doesn't implement BurnsCopyright (PartnerLogo).
     *
     * @var list<class-string<Model&StreamableImageFile>>
     */
    private const MODELS = [
        ItemImage::class,
        CollectionImage::class,
        PartnerImage::class,
        PartnerTranslationImage::class,
        ContributorImage::class,
        TimelineEventImage::class,
        PartnerLogo::class,
    ];

    /**
     * Return all registered model class names after validation.
     *
     * @return list<class-string<Model&StreamableImageFile>>
     *
     * @throws \RuntimeException if any entry is invalid.
     */
    public static function modelClasses(): array
    {
        self::validate();

        return self::MODELS;
    }

    /**
     * Return all database table names for registered models.
     *
     * @return list<string>
     */
    public static function tableNames(): array
    {
        return array_map(
            fn (string $class) => (new $class)->getTable(),
            self::modelClasses()
        );
    }

    /**
     * Yield every registered model instance from the database, chunked to avoid memory pressure.
     * Each yielded value is an instance of StreamableImageFile.
     */
    public static function eachImage(int $chunkSize = 500): \Generator
    {
        foreach (self::modelClasses() as $class) {
            foreach ($class::query()->cursor() as $record) {
                yield $record;
            }
        }
    }

    /**
     * Stream every referenced private-original storage path from registered
     * model rows in chunks. Yields strings of the form returned by
     * imageStoragePath() (the available-images disk, not the pictures cache).
     */
    public static function referencedPaths(int $chunkSize = 500): \Generator
    {
        foreach (self::modelClasses() as $class) {
            foreach ($class::query()->cursor() as $record) {
                /** @var StreamableImageFile $record */
                yield $record->imageStoragePath();
            }
        }
    }

    /**
     * Find the registered model instance owning the given path, checking
     * each registered table in turn. Short-circuits on the first match -
     * cheap thanks to A0.1's index on path across all 7 registry tables.
     *
     * @return (Model&StreamableImageFile)|null
     */
    public static function findByPath(string $path): ?Model
    {
        foreach (self::modelClasses() as $class) {
            $record = $class::query()->where('path', $path)->first();

            if ($record !== null) {
                return $record;
            }
        }

        return null;
    }

    /**
     * Validate all registered entries.
     * Fails fast on the first class that breaks the attached-image contract
     * (see validateClass()).
     *
     * @throws \RuntimeException
     */
    public static function validate(): void
    {
        foreach (self::MODELS as $class) {
            self::validateClass($class);
        }
    }

    /**
     * What every registry member must be: an Eloquent model that streams its
     * file (StreamableImageFile), resolves a copyright (HasCopyright - /pub
     * and the API burn it, unless the model is served unburned like
     * PartnerLogo), and removes both its files when deleted
     * (DeletesImageFilesOnDelete).
     *
     * @throws \RuntimeException naming the class and what it lacks
     */
    public static function validateClass(string $class): void
    {
        if (! class_exists($class)) {
            throw new \RuntimeException("AttachedImageRegistry: class does not exist: {$class}");
        }

        if (! is_subclass_of($class, Model::class)) {
            throw new \RuntimeException("AttachedImageRegistry: {$class} must extend ".Model::class);
        }

        foreach ([StreamableImageFile::class, HasCopyright::class] as $contract) {
            if (! is_subclass_of($class, $contract)) {
                throw new \RuntimeException("AttachedImageRegistry: {$class} must implement {$contract}");
            }
        }

        if (! in_array(DeletesImageFilesOnDelete::class, class_uses_recursive($class), true)) {
            throw new \RuntimeException('AttachedImageRegistry: '.$class.' must use '.DeletesImageFilesOnDelete::class);
        }
    }
}
