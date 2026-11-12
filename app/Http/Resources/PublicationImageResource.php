<?php

namespace App\Http\Resources;

use App\Models\PublicationImage;
use Illuminate\Http\Request;

/** @extends BaseJsonResource<PublicationImage> */
class PublicationImageResource extends BaseJsonResource
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
            // The publication this image belongs to
            'publication_id' => $this->resource->publication_id,
            // The edition whose cover this image is, if any
            'publication_edition_id' => $this->resource->publication_edition_id,
            // cover or page
            'kind' => $this->resource->kind,
            // The path to the image file
            'path' => $this->resource->path,
            // The original filename when uploaded
            'original_name' => $this->resource->original_name,
            // The MIME type of the image
            'mime_type' => $this->resource->mime_type,
            // The file size in bytes
            'size' => $this->resource->size,
            // Alternative text for accessibility
            'alt_text' => $this->resource->alt_text,
            // The image's own copyright, if any (else the project's, else the global one)
            'copyright' => $this->resource->copyright,
            // Display order for sorting images
            'display_order' => $this->resource->display_order,
            // Residual legacy values (holding area)
            'extra' => $this->resource->extra,
            // The publication this image belongs to (PublicationResource)
            'publication' => new PublicationResource($this->whenLoaded('publication')),
            // The edition whose cover this image is (PublicationEditionResource)
            'publicationEdition' => new PublicationEditionResource($this->whenLoaded('publicationEdition')),
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->resource->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
