<?php

namespace App\Http\Requests\Api;

use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePartnerTranslationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $uniqueRule = Rule::unique('partner_translations')
            ->where(fn (Builder $q) => $q
                ->where('partner_id', $this->input('partner_id'))
                ->where('language_id', $this->input('language_id'))
                ->where('context_id', $this->input('context_id'))
            );

        return [
            'id' => ['prohibited'],
            'partner_id' => ['required', 'uuid', 'exists:partners,id', $uniqueRule],
            'language_id' => ['required', 'string', 'size:3', 'exists:languages,id'],
            'context_id' => ['required', 'uuid', 'exists:contexts,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            // Address fields
            'city_display' => ['nullable', 'string', 'max:255'],
            'address_line_1' => ['nullable', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'address_notes' => ['nullable', 'string'],
            // Contact fields
            'contact_name' => ['nullable', 'string', 'max:255'],
            'contact_email_general' => ['nullable', 'email', 'max:255'],
            'contact_email_press' => ['nullable', 'email', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:50'],
            'contact_fax' => ['nullable', 'string', 'max:50'],
            'contact_website' => ['nullable', 'url', 'max:255'],
            'contact_notes' => ['nullable', 'string'],
            'contact_emails' => ['nullable', 'array'],
            'contact_emails.*' => ['email', 'max:255'],
            'contact_phones' => ['nullable', 'array'],
            'contact_phones.*' => ['string', 'max:50'],
            // Metadata
            'backward_compatibility' => ['nullable', 'string', 'max:255'],
            'extra' => ['nullable', 'array'],
        ];
    }
}
