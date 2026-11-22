<?php

namespace App\Listeners\Audit;

use App\Support\Audit\AuditLogger;
use Illuminate\Console\Events\CommandFinished;

/**
 * Records every run of an account, permission or OAuth command. Whoever can
 * reach the server may run them; the log keeps who (the server account) and
 * what (the command and its arguments, secrets left out).
 */
class RecordConsoleCommand
{
    /**
     * Command name prefixes that change accounts, roles, permissions or OAuth.
     */
    public const PREFIXES = ['user:', 'permissions:', 'auth:', 'passport:'];

    private const SECRET_WORDS = ['password', 'secret', 'token', 'key'];

    public function __construct(private readonly AuditLogger $logger) {}

    public static function audits(?string $command): bool
    {
        if ($command === null) {
            return false;
        }

        foreach (self::PREFIXES as $prefix) {
            if (str_starts_with($command, $prefix)) {
                return true;
            }
        }

        return false;
    }

    public function handle(CommandFinished $event): void
    {
        if (! self::audits($event->command)) {
            return;
        }

        $this->logger->record('console.command', null, [
            'command' => $event->command,
            'arguments' => $this->withoutSecrets($event->input->getArguments()),
            'options' => $this->withoutSecrets(array_filter(
                $event->input->getOptions(),
                fn (mixed $value): bool => $value !== null && $value !== false && $value !== [],
            )),
            'exit_code' => $event->exitCode,
        ], $event->command);
    }

    /**
     * @param  array<int|string, mixed>  $values
     * @return array<string, mixed>
     */
    private function withoutSecrets(array $values): array
    {
        foreach ($values as $name => $value) {
            foreach (self::SECRET_WORDS as $word) {
                if (str_contains(strtolower((string) $name), $word)) {
                    $values[$name] = '[hidden]';
                }
            }
        }

        unset($values['command']);

        // The command name, when the input carries it positionally
        return array_filter($values, fn (int|string $name): bool => ! is_int($name), ARRAY_FILTER_USE_KEY);
    }
}
