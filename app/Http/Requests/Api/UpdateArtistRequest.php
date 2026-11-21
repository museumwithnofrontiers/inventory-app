<?php

namespace App\Http\Requests\Api;

use App\Models\Artist;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateArtistRequest extends FormRequest
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
        $artist = $this->route('artist');

        return [
            'id' => ['prohibited'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'internal_name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('artists', 'internal_name')->ignore($artist instanceof Artist ? $artist->getKey() : null),
            ],
            'place_of_birth' => ['nullable', 'string', 'max:255'],
            'place_of_death' => ['nullable', 'string', 'max:255'],
            'date_of_birth' => ['nullable', 'string', 'max:255'],
            'date_of_death' => ['nullable', 'string', 'max:255'],
            'period_of_activity' => ['nullable', 'string', 'max:255'],
            'backward_compatibility' => ['nullable', 'string', 'max:255'],
        ];
    }
}
