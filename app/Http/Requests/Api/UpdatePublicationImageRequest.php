<?php

namespace App\Http\Requests\Api;

use App\Enums\PublicationImageKind;
use App\Http\Requests\Api\Concerns\HasIncludes;
use App\Models\PublicationImage;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePublicationImageRequest extends FormRequest
{
    use HasIncludes;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $image = $this->route('publicationImage');

        return [
            // Path and publication_id are immutable - not allowed in updates
            'kind' => ['sometimes', Rule::enum(PublicationImageKind::class)],
            // The edition must belong to the image's own publication
            'publication_edition_id' => [
                'sometimes', 'nullable', 'uuid',
                Rule::exists('publication_editions', 'id')
                    ->where('publication_id', $image instanceof PublicationImage ? $image->publication_id : null),
            ],
            'original_name' => ['sometimes', 'string', 'max:255'],
            'mime_type' => ['sometimes', 'string', 'max:100', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/'],
            'size' => ['sometimes', 'integer', 'min:1'],
            'alt_text' => ['sometimes', 'nullable', 'string', 'max:500'],
            'display_order' => ['sometimes', 'integer', 'min:1'],
            'extra' => ['sometimes', 'nullable', 'array'],
            'include' => ['sometimes', 'string', new IncludeRule('publication_image')],
        ];
    }

    protected function getIncludeAllowlistKey(): string
    {
        return 'publication_image';
    }
}
