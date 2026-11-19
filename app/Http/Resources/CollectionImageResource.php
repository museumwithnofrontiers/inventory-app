<?php

namespace App\Http\Resources;

use App\Models\CollectionImage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CollectionImage */
class CollectionImageResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            // The unique identifier (GUID)
            'id' => $this->id,
            // The collection this image belongs to
            'collection_id' => $this->collection_id,
            // The path to the image file
            'path' => $this->path,
            // The original filename when uploaded
            'original_name' => $this->original_name,
            // The MIME type of the image
            'mime_type' => $this->mime_type,
            // The file size in bytes
            'size' => $this->size,
            // Alternative text for accessibility
            'alt_text' => $this->alt_text,
            // The picture's photographer, if any
            'photographer' => $this->photographer,
            // The picture's own credit where it is not the text burned on it
            'credit' => $this->credit,
            // Display order for sorting images
            'display_order' => $this->display_order,
            // The collection this image belongs to (CollectionResource)
            'collection' => new CollectionResource($this->whenLoaded('collection')),
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->updated_at,
        ];
    }
}
