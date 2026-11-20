<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateImageTranslationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * The texts change; their image and language don't.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'id' => ['prohibited'],
            'image_type' => ['prohibited'],
            'image_id' => ['prohibited'],
            'language_id' => ['prohibited'],
            'caption' => ['sometimes', 'nullable', 'string'],
            'name' => ['sometimes', 'nullable', 'string'],
            'date' => ['sometimes', 'nullable', 'string'],
            'museum' => ['sometimes', 'nullable', 'string'],
            'location' => ['sometimes', 'nullable', 'string'],
            'copyright' => ['sometimes', 'nullable', 'string'],
            'photographer' => ['sometimes', 'nullable', 'string'],
            'backward_compatibility' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
