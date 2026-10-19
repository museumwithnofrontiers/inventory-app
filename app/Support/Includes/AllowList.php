<?php

namespace App\Support\Includes;

/**
 * Central registry for valid include keys per entity.
 */
class AllowList
{
    /**
     * Get the allow-list of include keys for an entity.
     *
     * @param  string  $entity  Lowercase resource/entity key (e.g. 'item', 'partner')
     * @return array<int, string>
     */
    public static function for(string $entity): array
    {
        return match ($entity) {
            'item' => [
                'partner', 'country', 'project', 'collection',
                'parent', 'children', 'itemImages',
                'artists', 'workshops', 'tags', 'dynasties', 'translations',
                'attachedToCollections', 'outgoingLinks', 'incomingLinks',
                'itemMedia', 'itemDocuments',
            ],
            'itemImage' => [
                'item',
            ],
            'item_item_link' => [
                'source', 'target', 'context', 'translations',
            ],
            'item_item_link_translation' => [
                'itemItemLink', 'language',
            ],
            'item_translation' => [
                'item', 'language', 'context', 'author', 'textCopyEditor', 'translator', 'translationCopyEditor',
                'credits',
            ],
            'collection' => [
                'language', 'context', 'translations', 'partners', 'items', 'attachedItems', 'collectionImages',
                'collectionMedia', 'contributors',
            ],
            'collectionImage' => [
                'collection',
            ],
            'partner' => [
                'country', 'items', 'pictures',
                'project', 'monumentItem',
                'translations', 'partnerImages', 'partnerLogos',
                'collections',
            ],
            'partner_translation' => [
                'partner', 'language', 'context',
                'partnerTranslationImages',
            ],
            'partner_image' => [
                'partner',
            ],
            'partner_logo' => [
                'partner',
            ],
            'partner_translation_image' => [
                'partnerTranslation',
            ],
            'country' => [
                'items', 'partners', 'translations',
            ],
            'country_translation' => [
                'country', 'language',
            ],
            'language' => [
                'translations',
            ],
            'language_translation' => [
                'language', 'displayLanguage',
            ],
            'project' => [
                'context', 'language',
            ],
            'contact' => [
                'translations',
            ],
            'address' => [
                'country', 'translations',
            ],
            'context' => [
                // Context model has no specific relationships
            ],
            'glossary' => [
                'translations', 'spellings', 'synonyms',
            ],
            'glossary_translation' => [
                'glossary', 'language',
            ],
            'glossary_spelling' => [
                'glossary', 'language', 'itemTranslations',
            ],
            'available_image' => [
                // AvailableImage model has no relationships
            ],
            'dynasty' => [
                'translations', 'items',
            ],
            'dynasty_translation' => [
                'dynasty', 'language', 'author', 'textCopyEditor', 'translator', 'translationCopyEditor',
            ],
            'author' => [
                'translations',
            ],
            'author_translation' => [
                'author', 'language', 'context',
            ],
            'timeline' => [
                'country', 'collection', 'events',
            ],
            'timeline_event' => [
                'timeline', 'translations', 'images', 'items',
            ],
            'timeline_event_translation' => [
                'timelineEvent', 'language',
            ],
            'timeline_event_image' => [
                'timelineEvent',
            ],
            'item_media' => [
                'item', 'language',
            ],
            'collection_media' => [
                'collection', 'language',
            ],
            'item_document' => [
                'item', 'language',
            ],
            'contributor' => [
                'collection', 'translations', 'contributorImages',
            ],
            'contributor_translation' => [
                'contributor', 'language', 'context',
            ],
            'contributor_image' => [
                'contributor',
            ],
            default => [],
        };
    }
}
