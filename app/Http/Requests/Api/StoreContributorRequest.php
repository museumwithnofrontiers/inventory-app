<?php

namespace App\Http\Requests\Api;

use App\Enums\ContributorCategory;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreContributorRequest extends FormRequest
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
            'collection_id' => ['required', 'uuid', 'exists:collections,id'],
            'category' => ['required', Rule::enum(ContributorCategory::class)],
            'display_order' => ['sometimes', 'integer', 'min:0'],
            'visible' => ['sometimes', 'boolean'],
            'backward_compatibility' => ['nullable', 'string'],
            'internal_name' => ['required', 'string'],
        ];
    }
}
