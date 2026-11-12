<?php

namespace App\Http\Resources;

use App\Models\Publication;
use Illuminate\Http\Request;

/** @extends BaseJsonResource<Publication> */
class PublicationResource extends BaseJsonResource
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
            // A name for this resource, for internal use only.
            'internal_name' => $this->resource->internal_name,
            // The Id(s) of matching resource in the legacy system (if any).
            'backward_compatibility' => $this->resource->backward_compatibility,
            // The kind of work: exhibition-trail, virtual-museum, educational, gallery or other
            'category' => $this->resource->category,
            // The project the publication belongs to (ProjectResource id), if any
            'project_id' => $this->resource->project_id,
            // The country the publication is about (CountryResource id), if any
            'country_id' => $this->resource->country_id,
            // The work's main language (LanguageResource id)
            'language_id' => $this->resource->language_id,
            // published or in-preparation
            'status' => $this->resource->status,
            // The display order among publications
            'display_order' => $this->resource->display_order,
            // Residual legacy values (holding area)
            'extra' => $this->resource->extra,
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->resource->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->resource->updated_at,

            // The project (ProjectResource)
            'project' => new ProjectResource($this->whenLoaded('project')),
            // The country (CountryResource)
            'country' => new CountryResource($this->whenLoaded('country')),
            // The main language (LanguageResource)
            'language' => new LanguageResource($this->whenLoaded('language')),
            // The translations (PublicationTranslationResource[])
            'translations' => PublicationTranslationResource::collection($this->whenLoaded('translations')),
            // The editions (PublicationEditionResource[])
            'editions' => PublicationEditionResource::collection($this->whenLoaded('editions')),
            // The covers and sample pages (PublicationImageResource[])
            'publicationImages' => PublicationImageResource::collection($this->whenLoaded('publicationImages')),
            // The collections the publication accompanies (CollectionResource[])
            'collections' => CollectionResource::collection($this->whenLoaded('collections')),
            // The items the publication cites (ItemResource[])
            'items' => ItemResource::collection($this->whenLoaded('items')),
            // Subjects, themes and target readers (TagResource[])
            'tags' => TagResource::collection($this->whenLoaded('tags')),
        ];
    }
}
