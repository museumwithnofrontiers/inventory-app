<?php

namespace App\Mcp\Servers;

use App\Mcp\LocalUser;
use App\Mcp\Tools\DescribeEntity;
use App\Mcp\Tools\FindByLegacyKey;
use App\Mcp\Tools\Get;
use App\Mcp\Tools\GetCollection;
use App\Mcp\Tools\GetItem;
use App\Mcp\Tools\ListEntityTypes;
use App\Mcp\Tools\Search;
use App\Mcp\Tools\ViewImage;
use App\Mcp\Tools\WhoAmI;
use Illuminate\Support\Facades\Auth;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Version;
use Laravel\Mcp\Server\Transport\StdioTransport;

/**
 * The read-only inventory MCP server, over HTTP (/mcp/inventory, OAuth scope
 * `mcp`) and through Artisan (`php artisan mcp:start inventory`).
 *
 * Every tool only reads, and acts as the signed-in user: the permissions and
 * App\Policies\* decide what it may see.
 */
#[Name('Museum With No Frontiers — Inventory')]
#[Version('1.0.0')]
#[Instructions(<<<'MARKDOWN'
    Read-only access to the inventory of Museum With No Frontiers: items,
    collections, partners and their translations, images and reference data.
    Nothing here changes the inventory.

    Start with `whoami` to see who you act as and which tools you may use,
    and `list_entity_types` for what can be browsed. `get_item` and
    `get_collection` give the views the websites show; `find_by_legacy_key`
    goes from a legacy record to what it was imported as.
    MARKDOWN)]
class InventoryServer extends Server
{
    /**
     * Every tool the server offers. Each must be annotated read-only
     * (tests/Api/Mcp/InventoryServerTest.php enforces it).
     *
     * @var array<int, class-string<Server\Tool>>
     */
    public const TOOLS = [
        WhoAmI::class,
        ListEntityTypes::class,
        DescribeEntity::class,
        Search::class,
        Get::class,
        GetItem::class,
        GetCollection::class,
        FindByLegacyKey::class,
        ViewImage::class,
    ];

    protected array $tools = self::TOOLS;

    protected function boot(): void
    {
        // Over HTTP the OAuth guard has signed the user in already
        if ($this->transport instanceof StdioTransport) {
            Auth::setUser(LocalUser::resolve());
        }
    }
}
