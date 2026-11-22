<?php

namespace App\Http\Requests\Api;

use App\Enums\PartnerCategory;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePartnerRequest extends FormRequest
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
            'type' => ['required', 'in:museum,institution,individual,school'],
            'country_id' => ['nullable', 'string', 'size:3', 'exists:countries,id'],
            // GPS Location
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'map_zoom' => ['nullable', 'integer', 'between:1,20'],
            // Relationships
            'project_id' => ['nullable', 'uuid', 'exists:projects,id'],
            'monument_item_id' => ['nullable', 'uuid', 'exists:items,id'],
            // M16 D2 (decision 7)
            'category' => ['nullable', Rule::enum(PartnerCategory::class)],
            'featured' => ['sometimes', 'boolean'],
            'city' => ['nullable', 'string', 'max:255'],
        ];
    }
}
