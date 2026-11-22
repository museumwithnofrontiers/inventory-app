<?php

namespace App\Filament\Resources\UserResource\Pages;

use App\Filament\Resources\UserResource;
use App\Models\User;
use App\Services\UserPasswordResetService;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class CreateUser extends CreateRecord
{
    protected static string $resource = UserResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        // Admin-created users are approved immediately and get a random 32-character
        // placeholder password that satisfies validation but is never exposed to the user.
        // The invitation email lets them set their own password via a Filament reset link.
        $data['approved_at'] = now();
        $data['password'] = Hash::make(Str::random(32));

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function handleRecordCreation(array $data): Model
    {
        return DB::transaction(function () use ($data): User {
            $user = User::query()->create(Arr::except($data, ['role']));

            // No role picked: no access until a user manager gives one
            if (filled($data['role'] ?? null)) {
                UserResource::applyRole($user, $data['role']);
            }

            return $user;
        });
    }

    protected function afterCreate(): void
    {
        /** @var User $user */
        $user = $this->record;

        app(UserPasswordResetService::class)->sendResetLink($user);

        Notification::make()
            ->success()
            ->title('User created and invitation sent')
            ->body('A password reset link has been sent to '.$user->email.'.')
            ->send();
    }
}
