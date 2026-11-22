<?php

namespace App\Support\Documentation\TypeToSchemaExtensions;

use App\Http\Responses\FileResponse;
use App\Http\Responses\Image\BurnedImageResponse;
use App\Http\Responses\Image\DownloadImageResponse;
use App\Http\Responses\Image\InlineImageResponse;
use Dedoc\Scramble\Extensions\TypeToSchemaExtension;
use Dedoc\Scramble\Support\Generator\Response;
use Dedoc\Scramble\Support\Generator\Schema;
use Dedoc\Scramble\Support\Generator\Types\StringType;
use Dedoc\Scramble\Support\Type\ObjectType;
use Dedoc\Scramble\Support\Type\Type;

/**
 * Documents the application's file responses as binary content.
 *
 * They are Responsables whose toResponse() streams a file, which Scramble cannot follow: it
 * documented most image views and downloads as a JSON string.
 */
class FileResponseToSchema extends TypeToSchemaExtension
{
    /** @var array<class-string, string> Media type of each response class. */
    private const MEDIA_TYPES = [
        BurnedImageResponse::class => 'image/*',
        InlineImageResponse::class => 'image/*',
        DownloadImageResponse::class => 'image/*',
        FileResponse::class => 'application/octet-stream',
    ];

    public function shouldHandle(Type $type): bool
    {
        return $this->mediaType($type) !== null;
    }

    public function toResponse(Type $type): ?Response
    {
        $mediaType = $this->mediaType($type);
        if ($mediaType === null) {
            return null;
        }

        return Response::make(200)
            ->setContent($mediaType, Schema::fromType((new StringType)->format('binary')));
    }

    private function mediaType(Type $type): ?string
    {
        if (! $type instanceof ObjectType) {
            return null;
        }

        foreach (self::MEDIA_TYPES as $class => $mediaType) {
            if ($type->isInstanceOf($class)) {
                return $mediaType;
            }
        }

        return null;
    }
}
