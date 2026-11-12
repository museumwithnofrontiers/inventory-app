<?php

namespace App\Http\Requests\Api;

use App\Enums\PublicationImageKind;
use App\Models\Publication;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePublicationImageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $publication = $this->route('publication');

        return [
            'kind' => ['required', Rule::enum(PublicationImageKind::class)],
            // The edition must belong to the same publication
            'publication_edition_id' => [
                'nullable', 'uuid',
                Rule::exists('publication_editions', 'id')
                    ->where('publication_id', $publication instanceof Publication ? $publication->id : null),
            ],
            'path' => ['required', 'string', 'max:500'],
            'original_name' => ['required', 'string', 'max:255'],
            'mime_type' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/'],
            'size' => ['required', 'integer', 'min:1'],
            'alt_text' => ['nullable', 'string', 'max:500'],
            'display_order' => ['sometimes', 'integer', 'min:1'],
            'extra' => ['nullable', 'array'],
        ];
    }
}
