<?php

namespace App\Http\Requests\Api;

use App\Enums\PublicationFormat;
use App\Http\Requests\Api\Concerns\AuthorizesPublicationUpdate;
use App\Models\Publication;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * An edition has no policy of its own: creating one is a change to its
 * publication, so it requires `update` on that publication.
 */
class StorePublicationEditionRequest extends FormRequest
{
    use AuthorizesPublicationUpdate;

    public function authorize(): bool
    {
        $publicationId = $this->input('publication_id');

        return $this->userMayUpdatePublication(
            is_string($publicationId) ? Publication::query()->whereKey($publicationId)->first() : null
        );
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'id' => ['prohibited'],
            'publication_id' => ['required', 'uuid', 'exists:publications,id'],
            'language_id' => ['required', 'string', 'size:3', 'exists:languages,id'],
            'format' => ['required', Rule::enum(PublicationFormat::class)],
            'edition' => ['nullable', 'integer', 'min:0'],
            'publish_year' => ['nullable', 'integer', 'min:0', 'max:32767'],
            'isbn' => ['nullable', 'string', 'max:255'],
            'publisher' => ['nullable', 'string', 'max:255'],
            'page_count' => ['nullable', 'integer', 'min:0'],
            'image_count' => ['nullable', 'integer', 'min:0'],
            'plan_count' => ['nullable', 'integer', 'min:0'],
            'dimensions' => ['nullable', 'string', 'max:255'],
            'binding' => ['nullable', 'string', 'max:255'],
            'visible' => ['sometimes', 'boolean'],
            'display_order' => ['nullable', 'integer', 'min:0'],
            'backward_compatibility' => ['nullable', 'string', 'max:255', 'unique:publication_editions,backward_compatibility'],
            'extra' => ['nullable', 'array'],
            'include' => ['sometimes', 'string', new IncludeRule('publication_edition')],
        ];
    }
}
