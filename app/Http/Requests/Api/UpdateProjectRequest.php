<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateProjectRequest extends FormRequest
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
            'backward_compatibility' => ['nullable', 'string'],
            'launch_date' => ['nullable', 'date'],
            'site_url' => ['nullable', 'url', 'max:255'],
            'related_database_url' => ['nullable', 'url', 'max:255'],
            'artistic_introduction_url' => ['nullable', 'url', 'max:255'],
            'context_id' => ['nullable', 'uuid'],
            'language_id' => ['nullable', 'string', 'size:3'],
        ];
    }
}
