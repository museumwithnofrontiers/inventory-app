<?php

namespace App\Http\Requests\Api;

use App\Enums\PublicationFormat;
use App\Http\Requests\Api\Concerns\AuthorizesPublicationUpdate;
use App\Models\Publication;
use App\Models\PublicationEdition;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Changing an edition requires `update` on its publication, and on the
 * publication it is moved to, if any.
 */
class UpdatePublicationEditionRequest extends FormRequest
{
    use AuthorizesPublicationUpdate;

    public function authorize(): bool
    {
        $edition = $this->route('publicationEdition');

        if ($edition instanceof PublicationEdition && ! $this->userMayUpdatePublication($edition->publication)) {
            return false;
        }

        $target = $this->input('publication_id');

        return ! is_string($target)
            || $this->userMayUpdatePublication(Publication::query()->whereKey($target)->first());
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $edition = $this->route('publicationEdition');

        return [
            'id' => ['prohibited'],
            'publication_id' => ['sometimes', 'required', 'uuid', 'exists:publications,id'],
            'language_id' => ['sometimes', 'required', 'string', 'size:3', 'exists:languages,id'],
            'format' => ['sometimes', 'required', Rule::enum(PublicationFormat::class)],
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
            'backward_compatibility' => [
                'nullable', 'string', 'max:255',
                Rule::unique('publication_editions', 'backward_compatibility')
                    ->ignore($edition instanceof PublicationEdition ? $edition->id : null),
            ],
            'extra' => ['nullable', 'array'],
            'include' => ['sometimes', 'string', new IncludeRule('publication_edition')],
        ];
    }
}
