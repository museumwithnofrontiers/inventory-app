<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateAvailableImageRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'id' => ['prohibited'],
            'path' => ['prohibited'],
            'original_name' => ['prohibited'],
            'mime_type' => ['prohibited'],
            'size' => ['prohibited'],
            'comment' => ['nullable', 'string'],
            'photographer' => ['nullable', 'string', 'max:255'],
            'credit' => ['nullable', 'string', 'max:500'],
        ];
    }
}
