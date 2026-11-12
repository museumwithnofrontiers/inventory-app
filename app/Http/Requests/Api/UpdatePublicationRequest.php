<?php

namespace App\Http\Requests\Api;

use App\Enums\PublicationCategory;
use App\Enums\PublicationStatus;
use App\Models\Publication;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePublicationRequest extends FormRequest
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
        $publicationId = $publication instanceof Publication ? $publication->id : null;

        return [
            'id' => ['prohibited'],
            'internal_name' => ['sometimes', 'required', 'string', 'max:255'],
            'backward_compatibility' => ['nullable', 'string', 'max:255', Rule::unique('publications', 'backward_compatibility')->ignore($publicationId)],
            'category' => ['sometimes', 'required', Rule::enum(PublicationCategory::class)],
            'project_id' => ['nullable', 'uuid', 'exists:projects,id'],
            'country_id' => ['nullable', 'string', 'size:3', 'exists:countries,id'],
            'language_id' => ['sometimes', 'required', 'string', 'size:3', 'exists:languages,id'],
            'status' => ['sometimes', Rule::enum(PublicationStatus::class)],
            'display_order' => ['nullable', 'integer', 'min:0'],
            'extra' => ['nullable', 'array'],
            'include' => ['sometimes', 'string', new IncludeRule('publication')],
        ];
    }
}
