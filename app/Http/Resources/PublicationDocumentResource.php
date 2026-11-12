<?php

namespace App\Http\Resources;

use App\Models\PublicationDocument;
use Illuminate\Http\Request;

/** @extends BaseJsonResource<PublicationDocument> */
class PublicationDocumentResource extends BaseJsonResource
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
            // The publication this document belongs to
            'publication_id' => $this->resource->publication_id,
            // The edition this document belongs to, if any
            'publication_edition_id' => $this->resource->publication_edition_id,
            // The language of the document, if any
            'language_id' => $this->resource->language_id,
            // sample or credits
            'kind' => $this->resource->kind,
            // The stored filename on the private documents disk
            'path' => $this->resource->path,
            // The original filename when uploaded
            'original_name' => $this->resource->original_name,
            // The MIME type of the document
            'mime_type' => $this->resource->mime_type,
            // The file size in bytes
            'size' => $this->resource->size,
            // Display order among the publication's documents
            'display_order' => $this->resource->display_order,
            // The Id(s) of matching resource in the legacy system (if any).
            'backward_compatibility' => $this->resource->backward_compatibility,
            // Residual legacy values (holding area)
            'extra' => $this->resource->extra,
            // The public URL the sites link to (/doc/{path})
            'public_url' => route('doc.document', ['filename' => $this->resource->path]),
            'publication' => new PublicationResource($this->whenLoaded('publication')),
            'publicationEdition' => new PublicationEditionResource($this->whenLoaded('publicationEdition')),
            'language' => new LanguageResource($this->whenLoaded('language')),
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->resource->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
