<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\IndexImageTranslationRequest;
use App\Http\Requests\Api\StoreImageTranslationRequest;
use App\Http\Requests\Api\UpdateImageTranslationRequest;
use App\Http\Resources\ImageTranslationResource;
use App\Models\ImageTranslation;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * An image's texts per language (M16 F2).
 */
class ImageTranslationController extends Controller
{
    /**
     * The texts of one image.
     */
    public function index(IndexImageTranslationRequest $request): AnonymousResourceCollection
    {
        return ImageTranslationResource::collection(
            ImageTranslation::query()
                ->where('image_type', $request->string('image_type')->value())
                ->where('image_id', $request->string('image_id')->value())
                ->orderBy('language_id')
                ->get()
        );
    }

    public function store(StoreImageTranslationRequest $request): ImageTranslationResource
    {
        $translation = new ImageTranslation($request->validated());
        $translation->image_type = $request->string('image_type')->value();
        $translation->image_id = $request->string('image_id')->value();
        $translation->save();

        return new ImageTranslationResource($translation);
    }

    public function show(ImageTranslation $imageTranslation): ImageTranslationResource
    {
        return new ImageTranslationResource($imageTranslation);
    }

    public function update(UpdateImageTranslationRequest $request, ImageTranslation $imageTranslation): ImageTranslationResource
    {
        $imageTranslation->update($request->validated());
        $imageTranslation->refresh();

        return new ImageTranslationResource($imageTranslation);
    }

    public function destroy(ImageTranslation $imageTranslation): Response
    {
        $imageTranslation->delete();

        return response()->noContent();
    }
}
