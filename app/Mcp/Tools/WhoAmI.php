<?php

namespace App\Mcp\Tools;

use App\Mcp\Servers\InventoryServer;
use App\Models\User;
use Illuminate\Container\Container;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;
use Laravel\Passport\AccessToken;
use Laravel\Passport\Client;
use Laravel\Passport\Passport;
use Laravel\Passport\Token;

#[Name('whoami')]
#[Description('Who this session acts as: the user, their roles and permissions, how the session is connected, and the tools they may use.')]
#[IsReadOnly]
class WhoAmI extends Tool
{
    public function handle(Request $request): Response|ResponseFactory
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return Response::error('No user is signed in.');
        }

        return Response::structured([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'mfa_enabled' => $user->hasEnabledTwoFactorAuthentication(),
            ],
            'roles' => $user->getRoleNames()->sort()->values()->all(),
            'permissions' => $user->getAllPermissions()->pluck('name')->sort()->values()->all(),
            'connection' => $this->connection($user),
            'tools' => $this->availableTools(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [];
    }

    /**
     * @return array<string, mixed>
     */
    private function connection(User $user): array
    {
        // Over HTTP the OAuth guard attaches the token it verified; the local
        // transport has none
        $token = $user->token();

        if (! $token instanceof AccessToken) {
            return ['transport' => 'local'];
        }

        $client = Passport::client()->newQuery()->find($token->oauth_client_id);
        $record = Passport::token()->newQuery()->find($token->oauth_access_token_id);

        return [
            'transport' => 'http',
            'client' => $client instanceof Client ? $client->name : null,
            'scopes' => $token->oauth_scopes,
            'expires_at' => $record instanceof Token ? $record->expires_at?->toIso8601String() : null,
        ];
    }

    /**
     * @return array<int, string>
     */
    private function availableTools(): array
    {
        $names = [];

        foreach (InventoryServer::TOOLS as $class) {
            $tool = Container::getInstance()->make($class);

            if ($tool->eligibleForRegistration()) {
                $names[] = $tool->name();
            }
        }

        return $names;
    }
}
