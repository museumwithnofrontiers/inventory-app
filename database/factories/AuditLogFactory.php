<?php

namespace Database\Factories;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AuditLog>
 */
class AuditLogFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'occurred_at' => now(),
            'actor_id' => null,
            'actor_label' => 'console: deploy@'.$this->faker->domainWord(),
            'channel' => 'console',
            'action' => 'user.updated',
            'subject_type' => User::class,
            'subject_id' => (string) $this->faker->numberBetween(1, 1000),
            'subject_label' => $this->faker->safeEmail(),
            'changes' => ['name' => ['from' => $this->faker->name(), 'to' => $this->faker->name()]],
            'ip_address' => null,
        ];
    }
}
