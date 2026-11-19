<?php

namespace App\Http\Resources;

use App\Models\AvailableImage;
use Illuminate\Http\Request;

/** @extends BaseJsonResource<AvailableImage> */
class AvailableImageResource extends BaseJsonResource
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
            'id' => $this->resource->id,
            // The path to the picture file
            'path' => $this->resource->path,
            // The original filename as uploaded
            'original_name' => $this->resource->original_name,
            // The MIME type of the file
            'mime_type' => $this->resource->mime_type,
            // The size of the processed file in bytes
            'size' => $this->resource->size,
            // A user defined comment associated with the file
            'comment' => $this->resource->comment,
            // The picture's photographer, if any
            'photographer' => $this->resource->photographer,
            // The picture's own credit where it is not the text burned on it
            'credit' => $this->resource->credit,
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->resource->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
