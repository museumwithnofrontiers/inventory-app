<?php

namespace App\Http\Controllers;

use App\Events\ImageUploadEvent;
use App\Http\Requests\Api\StoreImageUploadRequest;
use App\Http\Resources\AvailableImageResource;
use App\Http\Resources\ImageUploadResource;
use App\Http\Resources\ImageUploadStatusResource;
use App\Models\AvailableImage;
use App\Models\ImageUpload;
use App\Models\ItemImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

class ImageUploadController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): AnonymousResourceCollection
    {
        return ImageUploadResource::collection(ImageUpload::all());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreImageUploadRequest $request): ImageUploadResource
    {
        $validated = $request->validated();

        // Store the file in the local/private directory and disk.
        $file = $request->file('file');
        $storagePath = $file->store(Config::string('localstorage.uploads.images.directory'), Config::string('localstorage.uploads.images.disk'));

        // Store only the filename (no directory): ImageUpload::storagePath()
        // puts the uploads directory back
        $validated['path'] = basename((string) $storagePath);

        $imageUpload = ImageUpload::create($validated);
        $imageUpload->refresh();
        $imageUpload->update([
            'name' => $file->getClientOriginalName(),
            'extension' => $file->getClientOriginalExtension(),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
        ]);
        $imageUpload->refresh();
        ImageUploadEvent::dispatch($imageUpload);

        return new ImageUploadResource($imageUpload);
    }

    /**
     * Display the specified resource.
     */
    public function show(ImageUpload $imageUpload): ImageUploadResource
    {
        return new ImageUploadResource($imageUpload);
    }

    /**
     * Get the processing status of an image upload.
     *
     * Returns the processing status. If processing is complete, returns the AvailableImage details.
     * If the ImageUpload no longer exists, check if an AvailableImage exists with the same ID.
     */
    public function status(string $id): ImageUploadStatusResource|JsonResponse
    {
        // First check if the ImageUpload still exists (processing not complete)
        $imageUpload = ImageUpload::find($id);
        if ($imageUpload) {
            return new ImageUploadStatusResource((object) [
                'status' => 'processing',
                'available_image' => null,
            ]);
        }

        // Check if an AvailableImage exists with this ID (processing complete)
        $availableImage = AvailableImage::find($id);
        if ($availableImage) {
            return new ImageUploadStatusResource((object) [
                'status' => 'processed',
                'available_image' => new AvailableImageResource($availableImage),
            ]);
        }

        // Check if an ItemImage exists with this ID (image was attached to an item)
        $itemImage = ItemImage::find($id);
        if ($itemImage) {
            return new ImageUploadStatusResource((object) [
                'status' => 'attached',
                'available_image' => null,
            ]);
        }

        // Neither exists - this could be an error state or the resource was never created
        return response()->json(
            (new ImageUploadStatusResource((object) [
                'status' => 'not_found',
                'available_image' => null,
            ]))->toArray(request()),
            404
        );
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ImageUpload $imageUpload): Response
    {
        $path = $imageUpload->storagePath();
        if ($path !== null) {
            Storage::disk(Config::string('localstorage.uploads.images.disk'))->delete($path);
        }
        $imageUpload->delete();

        return response()->noContent();
    }
}
