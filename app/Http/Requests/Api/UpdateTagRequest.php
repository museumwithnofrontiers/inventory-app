<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateTagRequest extends FormRequest
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
        $tag = $this->route('tag');

        return [
            'id' => ['prohibited'],
            'internal_name' => ['required', 'string'],
            'category' => ['nullable', 'string', 'in:keyword,material,artist,dynasty,subject,theme,audience,type,filter,image-type'],
            'language_id' => ['nullable', 'string', 'size:3', 'exists:languages,id'],
            'backward_compatibility' => ['nullable', 'string'],
            'description' => ['required', 'string'],
        ];
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        // Uniqueness is enforced by database constraint, not validation
        // This allows updating other fields while keeping internal_name + category + language_id unchanged
    }
}
