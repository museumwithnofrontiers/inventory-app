<?php

namespace App\Enums;

use Laravel\Mcp\Server\Registrar;

/**
 * What an OAuth token may be used for. A scope limits the token; the user's
 * permissions and the policies still decide what the user may do, and a
 * request needs both.
 */
enum OAuthScope: string
{
    // The scope laravel/mcp advertises in its discovery metadata and grants
    // to the clients it registers, so the one MCP clients ask for
    case MCP = Registrar::OAUTH_SCOPE;
    case API_READ = 'api:read';
    case API_WRITE = 'api:write';

    /**
     * Shown on the consent page, next to the client asking for it.
     */
    public function description(): string
    {
        return match ($this) {
            self::MCP => 'Browse the inventory through its MCP server (read-only)',
            self::API_READ => 'Read inventory data through the REST API',
            self::API_WRITE => 'Create, change and delete inventory data through the REST API',
        };
    }

    /**
     * @return array<string, string> scope => description, as Passport::tokensCan() takes them
     */
    public static function descriptions(): array
    {
        $descriptions = [];

        foreach (self::cases() as $scope) {
            $descriptions[$scope->value] = $scope->description();
        }

        return $descriptions;
    }
}
