<?php

namespace App\Http\Requests\Api;

use App\Support\Images\AttachedImageRegistry;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexImageTranslationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * The texts of one image: its kind (morph alias) and id.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'image_type' => ['required', 'string', Rule::in(array_keys(AttachedImageRegistry::morphAliases()))],
            'image_id' => ['required', 'uuid'],
        ];
    }
}
