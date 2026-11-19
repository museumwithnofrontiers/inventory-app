<?php

namespace App\Http\Requests\Api;

use App\Enums\LinkType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLinkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * The owner comes from the route, never from the body.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'id' => ['prohibited'],
            'linkable_type' => ['prohibited'],
            'linkable_id' => ['prohibited'],
            'language_id' => ['nullable', 'string', 'size:3', 'exists:languages,id'],
            'type' => ['required', Rule::enum(LinkType::class)],
            'title' => ['nullable', 'string', 'max:255'],
            'url' => ['required', 'string', 'max:2048', 'url'],
            'description' => ['nullable', 'string'],
            'authors' => ['nullable', 'string'],
            'category' => ['nullable', 'integer', 'min:0', 'max:255'],
            'resource_type' => ['nullable', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'country_code' => ['nullable', 'string', 'max:16'],
            'further_reading' => ['nullable', 'string'],
            'display_order' => ['nullable', 'integer', 'min:0'],
            'extra' => ['nullable', 'json'],
            'backward_compatibility' => ['nullable', 'string', 'max:255'],
        ];
    }
}
