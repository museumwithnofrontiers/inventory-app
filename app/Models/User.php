<?php

namespace App\Models;

use App\Enums\Permission;
use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Auth\MustVerifyEmail as MustVerifyEmailTrait;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * @property string $name
 * @property string $email
 * @property string $password
 * @property Carbon|null $email_verified_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $two_factor_secret
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $approved_at
 * @property Carbon|null $suspended_at
 */
class User extends Authenticatable implements FilamentUser, MustVerifyEmail
{
    use HasApiTokens;

    /** @use HasFactory<UserFactory> */
    use HasFactory;

    use HasRoles;
    use MustVerifyEmailTrait;
    use Notifiable;
    use TwoFactorAuthenticatable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'approved_at',
        'suspended_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_recovery_codes',
        'two_factor_secret',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'approved_at' => 'datetime',
        'suspended_at' => 'datetime',
        'password' => 'hashed',
    ];

    /**
     * Validate and consume a recovery code using Fortify's standard secure approach.
     * Provides case-insensitive comparison while maintaining Fortify's replacement security model.
     */
    public function validateAndConsumeRecoveryCode(string $code): bool
    {
        if (! $this->hasEnabledTwoFactorAuthentication()) {
            return false;
        }

        $recoveryCodes = $this->recoveryCodes();

        if (empty($recoveryCodes)) {
            return false;
        }

        // Case insensitive comparison with Fortify's standard replacement approach
        foreach ($recoveryCodes as $recoveryCode) {
            if (hash_equals(strtolower($recoveryCode), strtolower($code))) {
                // Use Fortify's standard replacement approach (more secure than tracking)
                $this->replaceRecoveryCode($recoveryCode);

                return true;
            }
        }

        return false;
    }

    /**
     * Get the user's two factor authentication recovery codes.
     * Override Fortify's method to handle null values gracefully.
     *
     * @return array<int, string>
     */
    public function recoveryCodes(): array
    {
        if (is_null($this->two_factor_recovery_codes)) {
            return [];
        }

        $decrypted = decrypt($this->two_factor_recovery_codes);
        $codes = is_string($decrypted) ? json_decode($decrypted, true) : null;
        /** @var array<int, string> $result */
        $result = is_array($codes) ? $codes : [];

        return $result;
    }

    /**
     * Check if the user has any sensitive permissions that require MFA.
     */
    public function hasSensitivePermissions(): bool
    {
        $sensitivePermissions = Permission::sensitivePermissions();

        foreach ($sensitivePermissions as $permission) {
            if ($this->hasPermissionTo($permission)) {
                return true;
            }
        }

        return false;
    }

    public function canAccessPanel(Panel $panel): bool
    {
        if ($panel->getId() !== 'admin') {
            return false;
        }

        // Enforce panel access in order: email verification, approval, suspension, permission.
        if (! $this->hasVerifiedEmail()) {
            return false;
        }

        if ($this->approved_at === null) {
            return false;
        }

        if ($this->suspended_at !== null) {
            return false;
        }

        return $this->hasPermissionTo(Permission::ACCESS_ADMIN_PANEL->value);
    }
}
