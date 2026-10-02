<?php

namespace App\Http\Controllers\Filament;

use App\Http\Controllers\Controller;
use App\Models\User;
use Filament\Facades\Filament;
use Filament\Notifications\Notification;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\RedirectResponse;

/**
 * The link of every e-mail verification message, registered in
 * AdminPanelProvider::routes() outside the panel's authentication.
 *
 * A self-registered user verifies their address before an administrator has
 * approved them, while User::canAccessPanel() still turns them away, so the
 * link can't require a signed-in session the way Filament's own verification
 * route does. The signature and the hash of the address are the proof.
 */
class VerifyEmailController extends Controller
{
    public function __invoke(string $id, string $hash): RedirectResponse
    {
        $user = User::query()->find($id);

        if (! $user || ! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            abort(403);
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();

            event(new Verified($user));
        }

        $panel = Filament::getPanel('admin');
        $signedIn = Filament::auth()->user();

        if ($signedIn instanceof User && $signedIn->is($user) && $user->canAccessPanel($panel)) {
            return redirect()->to($panel->getUrl());
        }

        Notification::make()
            ->success()
            ->title(__('Your e-mail address is verified'))
            ->body($user->approved_at === null
                ? __('An administrator will review your account before you can sign in.')
                : __('You can now sign in.'))
            ->persistent()
            ->send();

        return redirect()->to($panel->getLoginUrl());
    }
}
