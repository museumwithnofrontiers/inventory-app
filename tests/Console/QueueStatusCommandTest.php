<?php

namespace Tests\Console;

use Illuminate\Contracts\Redis\Connection as RedisConnection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Queue\RedisQueue;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Queue;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class QueueStatusCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_reports_the_default_connection_the_app_uses(): void
    {
        Config::set('queue.default', 'database');
        Queue::connection('database')->push('App\Jobs\ExampleJob@handle', ['value' => 1]);

        $this->artisan('queue:status', ['--detailed' => true])
            ->expectsOutputToContain('Connection: database (driver: database)')
            ->expectsOutputToContain('Queue: default')
            ->expectsOutputToContain('Pending jobs in queue: 1')
            ->expectsOutputToContain('Job Type: App\Jobs\ExampleJob')
            ->expectsOutputToContain('php artisan queue:work database --queue=default')
            ->assertExitCode(0);
    }

    public function test_it_reports_the_sync_driver_without_a_worker(): void
    {
        Config::set('queue.default', 'sync');

        $this->artisan('queue:status')
            ->expectsOutputToContain('Connection: sync (driver: sync)')
            ->expectsOutputToContain('Pending jobs in queue: 0')
            ->expectsOutputToContain('there is no worker')
            ->assertExitCode(0);
    }

    public function test_it_reports_a_redis_queue_from_redis(): void
    {
        Config::set('queue.default', 'redis');

        $payload = json_encode(['uuid' => 'job-uuid-1', 'displayName' => 'App\Jobs\ExampleJob', 'attempts' => 0, 'createdAt' => 1_700_000_000]);
        $redis = Mockery::mock(RedisConnection::class);
        $redis->shouldReceive('lrange')->with('queues:default', 0, 4)->andReturn([$payload]);

        $queue = Mockery::mock(RedisQueue::class);
        $queue->shouldReceive('size')->with('default')->andReturn(3);
        $queue->shouldReceive('delayedSize')->with('default')->andReturn(1);
        $queue->shouldReceive('reservedSize')->with('default')->andReturn(1);
        $queue->shouldReceive('creationTimeOfOldestPendingJob')->with('default')->andReturn(1_700_000_000);
        $queue->shouldReceive('getQueue')->with('default')->andReturn('queues:default');
        $queue->shouldReceive('getConnection')->andReturn($redis);
        Queue::shouldReceive('connection')->with('redis')->andReturn($queue);

        $this->artisan('queue:status', ['--detailed' => true])
            ->expectsOutputToContain('Connection: redis (driver: redis)')
            ->expectsOutputToContain('Pending jobs in queue: 3')
            ->expectsOutputToContain('Delayed: 1')
            ->expectsOutputToContain('Reserved (running): 1')
            ->expectsOutputToContain('Job ID: job-uuid-1')
            ->expectsOutputToContain('Job Type: App\Jobs\ExampleJob')
            ->assertExitCode(0);
    }

    public function test_it_reports_failed_jobs_from_the_failer(): void
    {
        Config::set('queue.default', 'sync');
        $this->app->make('queue.failer')->log('redis', 'default', json_encode(['uuid' => 'failed-uuid-1', 'displayName' => 'App\Jobs\ExampleJob']), new RuntimeException('boom'));

        $this->artisan('queue:status', ['--detailed' => true])
            ->expectsOutputToContain('Failed jobs: 1')
            ->expectsOutputToContain('Connection: redis (not the reported connection)')
            ->expectsOutputToContain('Job Type: App\Jobs\ExampleJob')
            ->expectsOutputToContain('Error: RuntimeException: boom')
            ->assertExitCode(0);
    }

    public function test_it_reports_another_connection_on_request(): void
    {
        Config::set('queue.default', 'sync');
        Queue::connection('database')->push('App\Jobs\ExampleJob@handle', [], 'images');

        $this->artisan('queue:status', ['--connection' => 'database', '--queue' => 'images'])
            ->expectsOutputToContain('Connection: database (driver: database)')
            ->expectsOutputToContain('Queue: images')
            ->expectsOutputToContain('Pending jobs in queue: 1')
            ->assertExitCode(0);
    }

    public function test_it_fails_on_an_unknown_connection(): void
    {
        $this->artisan('queue:status', ['--connection' => 'nowhere'])
            ->expectsOutputToContain('Queue connection [nowhere] is not configured.')
            ->assertExitCode(1);
    }
}
