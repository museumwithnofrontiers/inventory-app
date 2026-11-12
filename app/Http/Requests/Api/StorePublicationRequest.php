<?php

namespace App\Http\Requests\Api;

use App\Enums\PublicationCategory;
use App\Enums\PublicationStatus;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePublicationRequest extends FormRequest
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
        return [
            'id' => ['prohibited'],
            'internal_name' => ['required', 'string', 'max:255'],
            'backward_compatibility' => ['nullable', 'string', 'max:255', 'unique:publications,backward_compatibility'],
            'category' => ['required', Rule::enum(PublicationCategory::class)],
            'project_id' => ['nullable', 'uuid', 'exists:projects,id'],
            'country_id' => ['nullable', 'string', 'size:3', 'exists:countries,id'],
            'language_id' => ['required', 'string', 'size:3', 'exists:languages,id'],
            'status' => ['sometimes', Rule::enum(PublicationStatus::class)],
            'display_order' => ['nullable', 'integer', 'min:0'],
            'extra' => ['nullable', 'array'],
            'include' => ['sometimes', 'string', new IncludeRule('publication')],
        ];
    }
}
