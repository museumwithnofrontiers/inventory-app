<?php

namespace App\Console\Commands;

use App\Models\AvailableImage;
use App\Models\ImageUpload;
use Illuminate\Console\Command;
use Illuminate\Contracts\Queue\Queue as QueueContract;
use Illuminate\Queue\DatabaseQueue;
use Illuminate\Queue\Failed\CountableFailedJobProvider;
use Illuminate\Queue\Failed\FailedJobProviderInterface;
use Illuminate\Queue\RedisQueue;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

/**
 * Reports the queue the app runs its jobs on: the default connection from
 * config/queue.php, whatever its driver, and the failed jobs its failer
 * records.
 */
class QueueStatusCommand extends Command
{
    /**
     * How many waiting jobs, failed jobs and recent images are listed.
     */
    private const SHOWN = 5;

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'queue:status
        {--connection= : The queue connection to report (default: the one the app uses)}
        {--queue= : The queue on that connection (default: the connection\'s own)}
        {--detailed : Show the job class of waiting jobs and the error of failed jobs}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Display the status of the queue the app uses and image processing information';

    /**
     * Execute the console command.
     */
    public function handle(FailedJobProviderInterface $failer): int
    {
        $connection = $this->stringOption('connection') ?? Config::string('queue.default');

        if (! is_array(Config::get("queue.connections.{$connection}"))) {
            $this->error("Queue connection [{$connection}] is not configured.");

            return self::FAILURE;
        }

        $driver = Config::string("queue.connections.{$connection}.driver");
        $queueName = $this->stringOption('queue')
            ?? $this->nullableString(Config::get("queue.connections.{$connection}.queue"))
            ?? 'default';
        $queue = Queue::connection($connection);

        $this->info('=== QUEUE STATUS CHECK ===');
        $this->line("Connection: <fg=cyan>{$connection}</> (driver: {$driver})");
        $this->line("Queue: <fg=cyan>{$queueName}</>");

        $pending = $this->reportSizes($queue, $queueName);
        $this->reportFailed($failer, $connection);

        $this->newLine();
        $this->line('Total ImageUploads: <fg=cyan>'.ImageUpload::count().'</>');
        $this->line('Total AvailableImages: <fg=cyan>'.AvailableImage::count().'</>');

        $this->reportRecentUploads();
        $this->reportRecentAvailableImages();

        if ($pending > 0) {
            $this->reportWaitingJobs($queue, $connection, $queueName);
        }

        $this->info('=== QUEUE WORKER STATUS ===');
        if ($driver === 'sync') {
            $this->line('<fg=green>The sync driver runs jobs as they are dispatched: there is no worker.</>');
        } elseif ($pending > 0) {
            $this->line('<fg=red>Jobs are waiting. If they do not drain, check that a worker runs:</>');
            $this->line("<fg=yellow>php artisan queue:work {$connection} --queue={$queueName}</>");
        } else {
            $this->line('<fg=green>No pending jobs in the queue.</>');
        }

        return self::SUCCESS;
    }

    /**
     * Prints the counts the driver knows and returns how many jobs wait.
     */
    private function reportSizes(QueueContract $queue, string $queueName): int
    {
        $pending = $queue->size($queueName);
        $this->line("Pending jobs in queue: <fg=yellow>{$pending}</>");

        // Not every driver tells these apart (sync, null)
        foreach (['delayedSize' => 'Delayed', 'reservedSize' => 'Reserved (running)'] as $method => $label) {
            if (method_exists($queue, $method)) {
                $this->line("{$label}: <fg=yellow>".$this->scalar($queue->{$method}($queueName)).'</>');
            }
        }

        if (method_exists($queue, 'creationTimeOfOldestPendingJob')) {
            $oldest = $queue->creationTimeOfOldestPendingJob($queueName);
            if (is_numeric($oldest)) {
                $this->line('Oldest pending job created: '.date('Y-m-d H:i:s', (int) $oldest));
            }
        }

        return $pending;
    }

    private function reportFailed(FailedJobProviderInterface $failer, string $connection): void
    {
        $failed = $failer instanceof CountableFailedJobProvider ? $failer->count() : count($failer->all());
        $color = $failed > 0 ? 'red' : 'green';
        $this->line("Failed jobs: <fg={$color}>{$failed}</>");

        if ($failed === 0) {
            return;
        }

        $this->newLine();
        $this->info('=== RECENT FAILED JOBS ===');

        foreach (array_slice($failer->all(), 0, self::SHOWN) as $job) {
            $jobConnection = $this->scalar($job->connection ?? null);
            $this->line('- ID: <fg=yellow>'.$this->scalar($job->uuid ?? $job->id ?? null).'</>');
            $this->line('  Connection: '.$jobConnection.($jobConnection === $connection ? '' : ' <fg=gray>(not the reported connection)</>'));
            $this->line('  Queue: '.$this->scalar($job->queue ?? null));
            $this->line('  Failed at: '.$this->scalar($job->failed_at ?? null));

            if ($this->option('detailed')) {
                $this->line('  Job Type: '.$this->displayName($job->payload ?? null));
                $this->line('  Error: '.(strtok($this->scalar($job->exception ?? null), "\n") ?: ''));
            }
        }
    }

    private function reportRecentUploads(): void
    {
        $this->newLine();
        $this->info('=== RECENT IMAGE UPLOADS ===');

        $recentUploads = ImageUpload::latest()->take(self::SHOWN)->get();
        if ($recentUploads->isEmpty()) {
            $this->line('<fg=gray>No image uploads found</>');

            return;
        }

        foreach ($recentUploads as $upload) {
            $this->line("- ID: <fg=yellow>{$upload->id}</>");
            $this->line("  Path: {$upload->path}");
            $this->line("  Name: {$upload->name}");
            $this->line('  Size: '.number_format((int) $upload->size).' bytes');
            $this->line("  Created: {$upload->created_at}");
            $this->line("  Updated: {$upload->updated_at}");
            $this->newLine();
        }
    }

    private function reportRecentAvailableImages(): void
    {
        $this->info('=== RECENT AVAILABLE IMAGES ===');

        $recentImages = AvailableImage::latest()->take(self::SHOWN)->get();
        if ($recentImages->isEmpty()) {
            $this->line('<fg=gray>No available images found</>');

            return;
        }

        foreach ($recentImages as $image) {
            $this->line("- ID: <fg=yellow>{$image->id}</>");
            $this->line("  Path: {$image->path}");
            $this->line('  Comment: '.($image->comment ?: '<fg=gray>No comment</>'));
            $this->line("  Created: {$image->created_at}");
            $this->line("  Updated: {$image->updated_at}");
            $this->newLine();
        }
    }

    /**
     * Lists the next jobs to run, read where the driver keeps them. Only the
     * database and redis drivers can be read without taking a job.
     */
    private function reportWaitingJobs(QueueContract $queue, string $connection, string $queueName): void
    {
        $this->info('=== PENDING JOBS DETAILS ===');

        $jobs = match (true) {
            $queue instanceof DatabaseQueue => $this->databaseJobs($connection, $queueName),
            $queue instanceof RedisQueue => $this->redisJobs($queue, $queueName),
            default => null,
        };

        if ($jobs === null) {
            $this->line('<fg=gray>This driver cannot list its jobs without taking them.</>');
            $this->newLine();

            return;
        }

        foreach ($jobs as $job) {
            $this->line('- Job ID: <fg=yellow>'.$job['id'].'</>');
            $this->line('  Attempts: '.$job['attempts']);
            $this->line('  Created at: '.($job['created_at'] !== null ? date('Y-m-d H:i:s', $job['created_at']) : 'N/A'));

            if ($this->option('detailed')) {
                $this->line('  Job Type: '.$this->displayName($job['payload']));
            }
            $this->newLine();
        }
    }

    /**
     * @return list<array{id: string, attempts: string, created_at: int|null, payload: mixed}>
     */
    private function databaseJobs(string $connection, string $queueName): array
    {
        $rows = DB::connection($this->nullableString(Config::get("queue.connections.{$connection}.connection")))
            ->table(Config::string("queue.connections.{$connection}.table"))
            ->where('queue', $queueName)
            ->orderBy('id')
            ->take(self::SHOWN)
            ->get();

        return $rows->map(fn (object $row): array => [
            'id' => $this->scalar($row->id ?? null),
            'attempts' => $this->scalar($row->attempts ?? null),
            'created_at' => is_numeric($row->created_at ?? null) ? (int) $row->created_at : null,
            'payload' => $row->payload ?? null,
        ])->values()->all();
    }

    /**
     * @return list<array{id: string, attempts: string, created_at: int|null, payload: mixed}>
     */
    private function redisJobs(RedisQueue $queue, string $queueName): array
    {
        $payloads = $queue->getConnection()->lrange($queue->getQueue($queueName), 0, self::SHOWN - 1);

        return array_values(array_map(function (mixed $payload): array {
            $decoded = is_string($payload) ? json_decode($payload, true) : null;
            $decoded = is_array($decoded) ? $decoded : [];

            return [
                'id' => $this->scalar($decoded['uuid'] ?? $decoded['id'] ?? null),
                'attempts' => $this->scalar($decoded['attempts'] ?? null),
                'created_at' => is_numeric($decoded['createdAt'] ?? null) ? (int) $decoded['createdAt'] : null,
                'payload' => $payload,
            ];
        }, is_array($payloads) ? $payloads : []));
    }

    private function displayName(mixed $payload): string
    {
        $decoded = is_string($payload) ? json_decode($payload, true) : null;

        return is_array($decoded) && is_string($decoded['displayName'] ?? null) ? $decoded['displayName'] : 'unknown';
    }

    private function stringOption(string $name): ?string
    {
        return $this->nullableString($this->option($name));
    }

    private function nullableString(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }

    private function scalar(mixed $value): string
    {
        return is_scalar($value) ? (string) $value : '';
    }
}
