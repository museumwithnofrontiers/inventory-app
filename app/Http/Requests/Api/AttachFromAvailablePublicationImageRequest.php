<?php

namespace App\Http\Requests\Api;

use App\Enums\PublicationImageKind;
use App\Http\Requests\Api\Concerns\HasIncludes;
use App\Models\Publication;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AttachFromAvailablePublicationImageRequest extends FormRequest
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
        $publication = $this->route('publication');

        return [
            'available_image_id' => ['required', 'uuid', 'exists:available_images,id'],
            'alt_text' => ['nullable', 'string'],
            'kind' => ['sometimes', Rule::enum(PublicationImageKind::class)],
            // The edition whose cover this is; it must belong to the publication
            'publication_edition_id' => [
                'nullable', 'uuid',
                Rule::exists('publication_editions', 'id')
                    ->where('publication_id', $publication instanceof Publication ? $publication->id : null),
            ],
            'include' => ['sometimes', 'string', new IncludeRule('publication_image')],
        ];
    }

    protected function getIncludeAllowlistKey(): string
    {
        return 'publication_image';
    }
}
