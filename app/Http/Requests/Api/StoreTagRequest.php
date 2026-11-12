<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreTagRequest extends FormRequest
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
        // Ensure uniqueness is checked across internal_name + category + language_id
        // This is handled by the database unique constraint, not validation
    }
}
