<?php

namespace Tests\Configuration;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * The Content Security Policy (config/csp.php) and the cookies of the pages
 * the app renders: the Filament panel, the web group and the API docs.
 */
class SecurityHeadersTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_login_carries_the_enforced_policy(): void
    {
        $response = $this->get(route('filament.admin.auth.login'));

        $response->assertOk();
        $this->assertSame([], $response->headers->all('content-security-policy-report-only'));
        $this->assertAppPolicy($response);
    }

    public function test_web_group_pages_carry_the_policy(): void
    {
        $response = $this->get(route('root'));

        $response->assertRedirect();
        $this->assertAppPolicy($response);
    }

    public function test_api_docs_allow_their_cdn_and_other_pages_do_not(): void
    {
        $docs = $this->get(route('scramble.docs.ui'))->assertOk();
        $login = $this->get(route('filament.admin.auth.login'))->assertOk();

        $this->assertStringContainsString('https://unpkg.com', $this->directive($docs, 'script-src'));
        $this->assertStringNotContainsString('unpkg.com', (string) $login->headers->get('Content-Security-Policy'));
    }

    public function test_the_policy_can_be_switched_to_report_only(): void
    {
        config([
            'csp.report_only_presets' => config('csp.presets'),
            'csp.presets' => [],
        ]);

        $response = $this->get(route('filament.admin.auth.login'));

        $this->assertFalse($response->headers->has('Content-Security-Policy'));
        $this->assertStringContainsString("frame-ancestors 'self'", (string) $response->headers->get('Content-Security-Policy-Report-Only'));
    }

    public function test_no_xsrf_token_cookie_is_sent(): void
    {
        $this->get(route('filament.admin.auth.login'))->assertCookieMissing('XSRF-TOKEN');
        $this->get(route('root'))->assertCookieMissing('XSRF-TOKEN');
    }

    public function test_the_session_cookie_stays_http_only(): void
    {
        $cookie = $this->get(route('filament.admin.auth.login'))->getCookie(config('session.cookie'), false);

        $this->assertNotNull($cookie);
        $this->assertTrue($cookie->isHttpOnly());
    }

    private function assertAppPolicy(TestResponse $response): void
    {
        $this->assertTrue($response->headers->has('Content-Security-Policy'));

        $this->assertSame("'self'", $this->directive($response, 'default-src'));
        $this->assertSame("'self'", $this->directive($response, 'frame-ancestors'));
        $this->assertSame("'self'", $this->directive($response, 'base-uri'));
        $this->assertSame("'none'", $this->directive($response, 'object-src'));
        $this->assertStringContainsString('fonts.bunny.net', $this->directive($response, 'font-src'));

        // A nonce would make browsers ignore the 'unsafe-inline' Filament needs
        $script = $this->directive($response, 'script-src');
        $this->assertStringContainsString("'unsafe-inline'", $script);
        $this->assertStringNotContainsString("'nonce-", $script);

        // form-action would block the OAuth consent's redirect to the client
        $this->assertNull($this->directive($response, 'form-action'));
    }

    private function directive(TestResponse $response, string $name): ?string
    {
        foreach (explode(';', (string) $response->headers->get('Content-Security-Policy')) as $directive) {
            $parts = explode(' ', trim($directive), 2);
            if ($parts[0] === $name) {
                return $parts[1] ?? '';
            }
        }

        return null;
    }
}
