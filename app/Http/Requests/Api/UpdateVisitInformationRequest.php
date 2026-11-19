<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\VisitInformationRules;
use App\Models\VisitInformation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateVisitInformationRequest extends FormRequest
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
        $current = $this->route('visitInformation');

        return $this->visitInformationRules(
            creating: false,
            current: $current instanceof VisitInformation ? $current : null,
        );
    }
}
