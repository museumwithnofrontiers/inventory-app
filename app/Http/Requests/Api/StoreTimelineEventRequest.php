<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreTimelineEventRequest extends FormRequest
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
            'timeline_id' => ['required', 'string', 'exists:timelines,id'],
            'internal_name' => ['required', 'string', 'max:255'],
            'year_from' => ['required', 'integer'],
            'year_to' => ['nullable', 'integer'],
            'year_from_ah' => ['nullable', 'integer'],
            'year_to_ah' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'display_order' => ['nullable', 'integer', 'min:0'],
            'backward_compatibility' => ['nullable', 'string'],
            'extra' => ['nullable', 'json'],
        ];
    }
}
