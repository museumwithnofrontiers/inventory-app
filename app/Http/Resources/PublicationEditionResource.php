<?php

namespace App\Http\Resources;

use App\Models\PublicationEdition;
use Illuminate\Http\Request;

/** @extends BaseJsonResource<PublicationEdition> */
class PublicationEditionResource extends BaseJsonResource
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
            // The publication this edition belongs to (PublicationResource id)
            'publication_id' => $this->resource->publication_id,
            // The language of this edition (LanguageResource id)
            'language_id' => $this->resource->language_id,
            // print, print-on-demand or ebook
            'format' => $this->resource->format,
            // The edition number
            'edition' => $this->resource->edition,
            'publish_year' => $this->resource->publish_year,
            'isbn' => $this->resource->isbn,
            // The publisher's name, as text
            'publisher' => $this->resource->publisher,
            'page_count' => $this->resource->page_count,
            'image_count' => $this->resource->image_count,
            'plan_count' => $this->resource->plan_count,
            // The size, as printed (e.g. "24 × 17 cm")
            'dimensions' => $this->resource->dimensions,
            // The binding, as printed
            'binding' => $this->resource->binding,
            // Whether the edition is shown
            'visible' => $this->resource->visible,
            // The display order among the publication's editions
            'display_order' => $this->resource->display_order,
            // The Id(s) of matching resource in the legacy system (if any).
            'backward_compatibility' => $this->resource->backward_compatibility,
            // Residual legacy values (holding area: legacy_texts, shop_links)
            'extra' => $this->resource->extra,
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->resource->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->resource->updated_at,

            'publication' => new PublicationResource($this->whenLoaded('publication')),
            'language' => new LanguageResource($this->whenLoaded('language')),
            // The covers of this edition (PublicationImageResource[])
            'publicationImages' => PublicationImageResource::collection($this->whenLoaded('publicationImages')),
        ];
    }
}
