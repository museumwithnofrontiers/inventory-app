<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\VisitInformationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreVisitInformationRequest extends FormRequest
{
    use VisitInformationRules;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return $this->visitInformationRules(creating: true);
    }
}
