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
            // A short description, as written (legacy description2)
            'short_description' => $this->short_description,
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
            // The region, as written (legacy province)
            'region' => $this->region,
            // The dimensions of the item
            'dimensions' => $this->dimensions,
            // The materials, as written
            'materials' => $this->materials,
            // The dynasty, as written (the Dynasty links are on the item)
            'dynasty' => $this->dynasty,
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
            // A monument's history, as written
            'history' => $this->history,
            // The author of the item (AuthorResource id)
            'author_id' => $this->author_id,
            // The copy-editor of the item (AuthorResource id)
            'text_copy_editor_id' => $this->text_copy_editor_id,
            // The translator of the item translation (AuthorResource id)
            'translator_id' => $this->translator_id,
            // The copy-editor of the item translation (AuthorResource id)
            'translation_copy_editor_id' => $this->translation_copy_editor_id,
            // The Id(s) of matching resource in the legacy system (if any).
            // The credits as legacy wrote them (the Author links are author_id and the others)
            'author_credit' => $this->author_credit,
            'copy_editor_credit' => $this->copy_editor_credit,
            'translator_credit' => $this->translator_credit,
            'translation_copy_editor_credit' => $this->translation_copy_editor_credit,
            // The keyword line and the artist lines as legacy wrote them (the Tags and Artist links are on the item)
            'keywords' => $this->keywords,
            'artist' => $this->artist,
            'artist_period_of_activity' => $this->artist_period_of_activity,
            'artist_birth_date' => $this->artist_birth_date,
            'artist_birth_place' => $this->artist_birth_place,
            'artist_death_date' => $this->artist_death_date,
            'artist_death_place' => $this->artist_death_place,
            'workshop' => $this->workshop,
            'scribe' => $this->scribe,
            'patrons' => $this->patrons,
            'architects' => $this->architects,
            // Not ready for any site: no site's data holds a draft text
            'draft' => $this->draft,
            // The catalogue references, the notices and the image rights line, as legacy wrote them
            'catalogue_references' => $this->catalogue_references,
            'notice' => $this->notice,
            'external_notice' => $this->external_notice,
            'image_rights' => $this->image_rights,
            // External sources as legacy wrote them (a text, links included)
            'external_sources' => $this->external_sources,
            // The name in the item's original language, as written (Sharing History)
            'original_name' => $this->original_name,
            // The holding institution's name in its own language, as written
            'holder_original_name' => $this->holder_original_name,
            // The archival reference or source citation, as written
            'archival_reference' => $this->archival_reference,
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
