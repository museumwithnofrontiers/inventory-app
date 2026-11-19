<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePartnerImageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'id' => ['prohibited'],
            'partner_id' => ['required', 'uuid', 'exists:partners,id'],
            'path' => ['required', 'string', 'max:255'],
            'original_name' => ['required', 'string', 'max:255'],
            'mime_type' => ['required', 'string', 'max:100'],
            'size' => ['required', 'integer', 'min:0'],
            'alt_text' => ['nullable', 'string'],
            'photographer' => ['nullable', 'string', 'max:255'],
            'credit' => ['nullable', 'string', 'max:500'],
            'display_order' => ['required', 'integer', 'min:1'],
        ];
    }
}
