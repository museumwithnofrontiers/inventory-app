<?php

namespace App\Actions;

use App\Models\User;

/**
 * Deletes an account and the API tokens issued to it. Used by the profile
 * page's "Delete Account" action.
 */
class DeleteUser
{
    public function delete(User $user): void
    {
        $user->deleteProfilePhoto();
        $user->tokens->each->delete();
        $user->delete();
    }
}
