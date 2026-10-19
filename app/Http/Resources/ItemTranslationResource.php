<?php

namespace App\Http\Resources;

use App\Models\Author;
use App\Models\Item;
use App\Models\ItemTranslation;
use App\Models\ItemTranslationAuthor;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ItemTranslation
 */
class ItemTranslationResource extends JsonResource
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
            // The item this translation belongs to (ItemResource id)
            'item_id' => $this->item_id,
            // The language of this translation (LanguageResource id)
            'language_id' => $this->language_id,
            // The context of this translation (ContextResource id)
            'context_id' => $this->context_id,
            // The name of the item translation
            'name' => $this->name,
            // The alternate name of the item translation
            'alternate_name' => $this->alternate_name,
            // The description of the item translation
            'description' => $this->description,
            // The type of the item translation
            'type' => $this->type,
            // The holder of the item
            'holder' => $this->holder,
            // The owner of the item
            'owner' => $this->owner,
            // The initial owner of the item
            'initial_owner' => $this->initial_owner,
            // The dates associated with the item
            'dates' => $this->dates,
            // The location associated with the item
            'location' => $this->location,
            // The dimensions of the item
            'dimensions' => $this->dimensions,
            // The place of production of the item
            'place_of_production' => $this->place_of_production,
            // The method for datation of the item
            'method_for_datation' => $this->method_for_datation,
            // The method for provenance of the item
            'method_for_provenance' => $this->method_for_provenance,
            // The ownership history of the item
            'provenance' => $this->provenance,
            // The obtention of the item
            'obtention' => $this->obtention,
            // The bibliography for the item
            'bibliography' => $this->bibliography,
            // The author of the item (AuthorResource id)
            'author_id' => $this->author_id,
            // The copy-editor of the item (AuthorResource id)
            'text_copy_editor_id' => $this->text_copy_editor_id,
            // The translator of the item translation (AuthorResource id)
            'translator_id' => $this->translator_id,
            // The copy-editor of the item translation (AuthorResource id)
            'translation_copy_editor_id' => $this->translation_copy_editor_id,
            // The Id(s) of matching resource in the legacy system (if any).
            'backward_compatibility' => $this->backward_compatibility,
            // Extra data for translation (object, may be null)
            'extra' => $this->extra,
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->updated_at,

            // The item relationship (ItemResource)
            'item' => new ItemResource($this->whenLoaded('item', fn (Item $item): Item => $item->withoutRelations())),
            // The language relationship (LanguageResource)
            'language' => new LanguageResource($this->whenLoaded('language')),
            // The context relationship (ContextResource)
            'context' => new ContextResource($this->whenLoaded('context')),
            // The author relationship (AuthorResource)
            'author' => new AuthorResource($this->whenLoaded('author')),
            // The copy-editor relationship (AuthorResource)
            'text_copy_editor' => new AuthorResource($this->whenLoaded('textCopyEditor')),
            // The translator relationship (AuthorResource)
            'translator' => new AuthorResource($this->whenLoaded('translator')),
            // The translation copy-editor relationship (AuthorResource)
            'translation_copy_editor' => new AuthorResource($this->whenLoaded('translationCopyEditor')),
            // Every person credited, per role and in order (role, display_order, AuthorResource)
            'credits' => $this->whenLoaded('credits', fn (): array => $this->resource->credits
                ->map(function (Author $author): array {
                    /** @var ItemTranslationAuthor $credit */
                    $credit = $author->getRelationValue('pivot');

                    return [
                        'role' => $credit->role,
                        'display_order' => $credit->display_order,
                        'author' => new AuthorResource($author),
                    ];
                })
                ->values()
                ->all()),
        ];
    }
}
