<?php

namespace App\Http\Requests\Api;

use App\Enums\LinkType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLinkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * A link keeps its owner.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'id' => ['prohibited'],
            'linkable_type' => ['prohibited'],
            'linkable_id' => ['prohibited'],
            'language_id' => ['sometimes', 'nullable', 'string', 'size:3', 'exists:languages,id'],
            'type' => ['sometimes', Rule::enum(LinkType::class)],
            'title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'url' => ['sometimes', 'string', 'max:2048', 'url'],
            'description' => ['sometimes', 'nullable', 'string'],
            'authors' => ['sometimes', 'nullable', 'string'],
            'category' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:255'],
            'resource_type' => ['sometimes', 'nullable', 'string', 'max:255'],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'country_code' => ['sometimes', 'nullable', 'string', 'max:16'],
            'further_reading' => ['sometimes', 'nullable', 'string'],
            'display_order' => ['sometimes', 'integer', 'min:0'],
            'extra' => ['sometimes', 'nullable', 'json'],
            'backward_compatibility' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
