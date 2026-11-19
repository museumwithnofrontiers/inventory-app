<?php

namespace App\Http\Requests\Api\Concerns;

/**
 * The rules the Store and Update requests of a placement's texts share
 * (M16 C2). Every text is optional and kept as written.
 */
trait ValidatesCollectionItemTranslationTexts
{
    /**
     * @return array<string, array<int, string>>
     */
    protected function textRules(): array
    {
        return [
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'curator_justification' => ['nullable', 'string'],
            'partner_justification' => ['nullable', 'string'],
            'justification' => ['nullable', 'string'],
            'caption' => ['nullable', 'string'],
            'item_name' => ['nullable', 'string'],
            'item_date' => ['nullable', 'string'],
            'item_location' => ['nullable', 'string'],
            'item_museum' => ['nullable', 'string'],
            'item_dynasty' => ['nullable', 'string'],
            'item_artist' => ['nullable', 'string'],
            'item_material' => ['nullable', 'string'],
            'backward_compatibility' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function textMessages(): array
    {
        return [
            'language_id.unique' => 'This placement already has texts in this language.',
        ];
    }
}
