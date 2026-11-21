<?php

namespace Tests\Unit\Support\Markdown;

use App\Support\Markdown\MarkdownText;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The panel's renderer for stored text, which is Markdown written by the
 * importer's HTML conversion. The cases come from staging rows.
 */
class MarkdownTextTest extends TestCase
{
    public function test_inline_keeps_emphasis_and_strong(): void
    {
        $this->assertSame('<em>Ratto di Proserpina</em> (1)', MarkdownText::inline('*Ratto di Proserpina* (1)')->toHtml());
        $this->assertSame('<strong>Bowl</strong> and <em>dish</em>', MarkdownText::inline('**Bowl** and _dish_')->toHtml());
        $this->assertSame('<code>c</code> <del>d</del>', MarkdownText::inline('`c` ~~d~~')->toHtml());
    }

    public function test_inline_reduces_links_and_images_to_their_text(): void
    {
        // A table cell is already a link to its record, and the panel never loads remote pictures.
        $this->assertSame('a link and https://y.org', MarkdownText::inline('a [link](https://x.org) and <https://y.org>')->toHtml());
        $this->assertSame('picture', MarkdownText::inline('![picture](https://example.org/p.png)')->toHtml());
    }

    public function test_inline_resolves_escapes_and_line_breaks(): void
    {
        $this->assertSame('<em>Guisot</em> (sic) [etc.] (1)', MarkdownText::inline('*Guisot* (sic) \[etc.\] (1)')->toHtml());
        $this->assertStringContainsString('Church of Mariahilf<br', MarkdownText::inline("Church of Mariahilf  \nMariahilf Parish Church (4)")->toHtml());
        // The websites render with `breaks: true`: one newline is a line break.
        $this->assertStringContainsString('Line one<br', MarkdownText::inline("Line one\nLine two")->toHtml());
    }

    /**
     * @return array<string, array{string}>
     */
    public static function hostileText(): array
    {
        return [
            'script element' => ['<script>alert(1)</script> *x*'],
            'image with handler' => ['<img src=x onerror="alert(1)">'],
            'inline tag' => ['Source: <i>Atlas</i>, 2013'],
            'javascript link' => ['[bad](javascript:alert(1))'],
            'data link' => ['[bad](data:text/html;base64,PHNjcmlwdD4=)'],
        ];
    }

    #[DataProvider('hostileText')]
    public function test_raw_html_is_escaped_and_unsafe_links_refused_in_every_mode(string $text): void
    {
        foreach ([MarkdownText::inline($text)->toHtml(), MarkdownText::block($text)->toHtml()] as $html) {
            $this->assertStringNotContainsString('<script', $html);
            $this->assertStringNotContainsString('<img', $html);
            $this->assertStringNotContainsString('<i>', $html);
            $this->assertStringNotContainsString('javascript:', $html);
            $this->assertStringNotContainsString('data:text', $html);
        }
    }

    public function test_raw_html_shows_as_the_characters_it_is(): void
    {
        $this->assertSame('&lt;script&gt;alert(1)&lt;/script&gt; <em>x</em>', MarkdownText::inline('<script>alert(1)</script> *x*')->toHtml());
        $this->assertSame('<p>Source: &lt;i&gt;Atlas&lt;/i&gt;, 2013</p>', MarkdownText::block('Source: <i>Atlas</i>, 2013')->toHtml());
        // Plain text keeps the characters; whoever prints it (Blade, Filament) escapes them.
        $this->assertSame('Source: <i>Atlas</i>, 2013', MarkdownText::plain('Source: <i>Atlas</i>, 2013'));
    }

    public function test_block_keeps_structure_and_opens_links_safely(): void
    {
        $html = MarkdownText::block("# Head\n\n- one\n- two\n\nSee [the museum](https://example.org).")->toHtml();

        $this->assertStringContainsString('<h1>Head</h1>', $html);
        $this->assertStringContainsString('<li>one</li>', $html);
        $this->assertStringContainsString('href="https://example.org"', $html);
        $this->assertStringContainsString('target="_blank"', $html);
        $this->assertStringContainsString('noopener', $html);
        $this->assertStringContainsString('noreferrer', $html);
    }

    public function test_block_reduces_images_to_their_alternative_text(): void
    {
        $this->assertSame('<p>A picture</p>', MarkdownText::block('![A picture](https://example.org/p.png)')->toHtml());
    }

    public function test_plain_removes_markup_on_one_line(): void
    {
        $this->assertSame('Ratto di Proserpina (1)', MarkdownText::plain('*Ratto di Proserpina* (1)'));
        $this->assertSame('Guisot (sic): Sir [etc.] (1)', MarkdownText::plain('*Guisot* (sic): *Sir* \[etc.\] (1)'));
        $this->assertSame('Church of Mariahilf Mariahilf Parish Church (4)', MarkdownText::plain("Church of Mariahilf  \nMariahilf Parish Church (4)"));
        $this->assertSame('a link & <i>', MarkdownText::plain('a [link](https://x.org) &amp; &lt;i&gt;'));
        $this->assertSame('snake_case_name', MarkdownText::plain('snake_case_name'));
    }

    public function test_excerpt_reads_block_structure_and_cuts(): void
    {
        $this->assertSame('Head one two para link', MarkdownText::excerpt("# Head\n\n- one\n- two\n\npara [link](https://a.b)", 100));
        $this->assertSame('Ratto di...', MarkdownText::excerpt('*Ratto di Proserpina*', 8));
        $this->assertSame('<script>alert(1)</script> *x*', MarkdownText::excerpt('<script>alert(1)</script> *x*', 100));
    }

    public function test_empty_and_null_give_empty_output(): void
    {
        $this->assertSame('', MarkdownText::inline(null)->toHtml());
        $this->assertSame('', MarkdownText::block('')->toHtml());
        $this->assertSame('', MarkdownText::plain(null));
        $this->assertSame('', MarkdownText::excerpt(null, 10));
        $this->assertSame('42', MarkdownText::plain(42));
    }
}
