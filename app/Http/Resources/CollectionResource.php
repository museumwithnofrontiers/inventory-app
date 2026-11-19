<?php

namespace App\Http\Resources;

use App\Models\Collection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Collection Resource
 *
 * Transforms Collection model data for API responses.
 * Includes relationships and computed attributes for API consumption.
 *
 * @mixin Collection
 */
class CollectionResource extends JsonResource
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
            // A name for this resource, for internal use only.
            'internal_name' => $this->internal_name,
            // The type of collection: 'collection', 'exhibition', or 'gallery'
            'type' => $this->type,
            // The functional purpose of the collection within its context (e.g. 'exhibitions-root'), null for ordinary collections
            'purpose' => $this->purpose,
            // The language this collection belongs to (LanguageResource id)
            'language_id' => $this->language_id,
            // The context this collection belongs to (ContextResource id)
            'context_id' => $this->context_id,
            // The parent collection ID (for hierarchical organization)
            'parent_id' => $this->parent_id,
            // The display order within sibling collections
            'display_order' => $this->display_order,
            // The Id(s) of matching resource in the legacy system (if any).
            'backward_compatibility' => $this->backward_compatibility,
            // Collection-level structured attributes that belong to the collection rather than to one of its languages (e.g. a thematic gallery's source project, slug and canonical host)
            'extra' => $this->extra,
            // The picture shown as the collection's cover (ItemResource id), e.g. a gallery theme's
            'cover_item_id' => $this->cover_item_id,
            // A Travels itinerary's number of days
            'days' => $this->days,
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->updated_at,

            // The language relationship (LanguageResource)
            'language' => new LanguageResource($this->whenLoaded('language')),
            // The context relationship (ContextResource)
            'context' => new ContextResource($this->whenLoaded('context')),
            // The parent collection (CollectionResource)
            'parent' => new CollectionResource($this->whenLoaded('parent')),
            // Child collections (CollectionResource[])
            'children' => CollectionResource::collection($this->whenLoaded('children')),
            // Translations for this collection (CollectionTranslationResource[])
            'translations' => CollectionTranslationResource::collection($this->whenLoaded('translations')),
            // Partners associated with this collection (PartnerResource[])
            'partners' => PartnerResource::collection($this->whenLoaded('partners')),
            // The other countries the collection covers, in their order (CountryResource[])
            'countries' => CountryResource::collection($this->whenLoaded('countries')),
            // The collections this one links to, with the link's kind and order (CollectionResource[])
            'relatedCollections' => CollectionResource::collection($this->whenLoaded('relatedCollections')),
            // The cover picture (ItemResource)
            'coverItem' => new ItemResource($this->whenLoaded('coverItem')),
            // Items associated with this collection - primary relationship (ItemResource[])
            'items' => ItemResource::collection($this->whenLoaded('items')),
            // Items attached to this collection via many-to-many relationship (ItemResource[])
            'attachedItems' => ItemResource::collection($this->whenLoaded('attachedItems')),

            // The number of items in this collection (computed)
            'items_count' => $this->when($this->relationLoaded('items'), fn () => $this->items->count()),
            'attached_items_count' => $this->when($this->relationLoaded('attachedItems'), fn () => $this->attachedItems->count()),
            'partners_count' => $this->when($this->relationLoaded('partners'), fn () => $this->partners->count()),
            'translations_count' => $this->when($this->relationLoaded('translations'), fn () => $this->translations->count()),
            'children_count' => $this->when($this->relationLoaded('children'), fn () => $this->children->count()),

            // On a related collection: the link's kind (CollectionRelationKind) and order
            'link' => $this->whenPivotLoaded('collection_collection', function (): array {
                /** @var Model $pivot */
                $pivot = $this->resource->getRelation('pivot');

                return [
                    'kind' => $pivot->getAttribute('kind'),
                    'display_order' => $pivot->getAttribute('display_order'),
                ];
            }),
        ];
    }
}
