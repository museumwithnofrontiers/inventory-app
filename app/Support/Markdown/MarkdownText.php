<?php

namespace App\Support\Markdown;

use Illuminate\Support\HtmlString;
use Illuminate\Support\Str;
use League\CommonMark\Environment\Environment;
use League\CommonMark\Event\DocumentParsedEvent;
use League\CommonMark\Extension\CommonMark\CommonMarkCoreExtension;
use League\CommonMark\Extension\CommonMark\Node\Inline\Image;
use League\CommonMark\Extension\CommonMark\Node\Inline\Link;
use League\CommonMark\Extension\ExternalLink\ExternalLinkExtension;
use League\CommonMark\Extension\GithubFlavoredMarkdownExtension;
use League\CommonMark\Extension\InlinesOnly\InlinesOnlyExtension;
use League\CommonMark\Extension\Strikethrough\StrikethroughExtension;
use League\CommonMark\MarkdownConverter;
use League\CommonMark\Node\Block\AbstractBlock;
use League\CommonMark\Node\Block\Document;
use League\CommonMark\Node\Inline\Newline;
use League\CommonMark\Node\Node;
use League\CommonMark\Node\StringContainerInterface;
use League\CommonMark\Parser\MarkdownParser;

/**
 * Displays stored text, which is Markdown, in the panel.
 *
 * The importer converts legacy HTML to Markdown, and the websites render it,
 * so any name or text may carry `*emphasis*`, `**strong**`, links, escapes
 * (`\[`) or line breaks. The panel never changes the stored text: it renders
 * it here, at the point of display, in one of four ways.
 *
 * - {@see self::inline()}: one line of HTML for table cells, tree nodes and
 *   short infolist entries. Emphasis, strong, code and strikethrough are kept;
 *   links and images are reduced to their text (a cell is already a link to
 *   its record); line breaks become `<br>`.
 * - {@see self::block()}: HTML for long texts in infolists. Paragraphs,
 *   lists, tables and links are kept; links open in a new window with
 *   `rel="noopener noreferrer nofollow"`; images are reduced to their
 *   alternative text, so the panel never loads a remote picture.
 * - {@see self::plain()}: text without any markup, for places that can't
 *   hold HTML: record titles, breadcrumbs, page titles, global search
 *   results, select options, notifications.
 * - {@see self::excerpt()}: plain text of a long text, cut to a length, for
 *   table cells that show the start of a description.
 *
 * In every mode raw HTML in the text is escaped, never rendered: a stray
 * `<i>` shows as the characters it is, as it does on the websites, and a
 * `<script>` is inert. Unsafe links (`javascript:`, `data:` …) are refused.
 * The text is parsed by league/commonmark, never approximated with a regex.
 */
final class MarkdownText
{
    /** @var array<string, mixed> */
    private const CONFIG = [
        'html_input' => 'escape',
        'allow_unsafe_links' => false,
        'max_nesting_level' => 20,
        // The websites render with `breaks: true`: a single newline is a line break.
        'renderer' => ['soft_break' => "<br>\n"],
    ];

    private static ?MarkdownConverter $inlineConverter = null;

    private static ?MarkdownConverter $blockConverter = null;

    private static ?MarkdownParser $inlineParser = null;

    private static ?MarkdownParser $blockParser = null;

    /**
     * One line of safe HTML: emphasis kept, links reduced to their text.
     */
    public static function inline(mixed $markdown): HtmlString
    {
        $text = self::text($markdown);
        if ($text === '') {
            return new HtmlString('');
        }

        self::$inlineConverter ??= new MarkdownConverter(self::inlineEnvironment());

        return new HtmlString(trim(self::$inlineConverter->convert($text)->getContent()));
    }

    /**
     * Block HTML for a long text: paragraphs, lists and links kept.
     */
    public static function block(mixed $markdown): HtmlString
    {
        $text = self::text($markdown);
        if ($text === '') {
            return new HtmlString('');
        }

        self::$blockConverter ??= new MarkdownConverter(self::blockEnvironment());

        return new HtmlString(trim(self::$blockConverter->convert($text)->getContent()));
    }

    /**
     * The text without markup, on one line. Returns '' for null.
     */
    public static function plain(mixed $markdown): string
    {
        $text = self::text($markdown);
        if ($text === '') {
            return '';
        }

        self::$inlineParser ??= new MarkdownParser(self::inlineEnvironment());

        return self::flatten(self::$inlineParser->parse($text));
    }

    /**
     * The plain text of a long text, cut to `$limit` characters.
     */
    public static function excerpt(mixed $markdown, int $limit): string
    {
        $text = self::text($markdown);
        if ($text === '') {
            return '';
        }

        self::$blockParser ??= new MarkdownParser(self::blockEnvironment());

        return Str::limit(self::flatten(self::$blockParser->parse($text)), $limit);
    }

    private static function text(mixed $markdown): string
    {
        return is_string($markdown) ? $markdown : (is_scalar($markdown) ? (string) $markdown : '');
    }

    /**
     * Concatenate the literal text of a parsed document: text, code and raw
     * HTML as written (whoever prints the result escapes it); line breaks and
     * block boundaries as one space.
     */
    private static function flatten(Document $document): string
    {
        $out = '';
        $walker = $document->walker();

        while ($event = $walker->next()) {
            $node = $event->getNode();

            if (! $event->isEntering()) {
                if ($node instanceof AbstractBlock) {
                    $out .= ' ';
                }

                continue;
            }

            if ($node instanceof StringContainerInterface) {
                $out .= $node->getLiteral();
            } elseif ($node instanceof Newline) {
                $out .= ' ';
            }
        }

        return trim((string) preg_replace('/\s+/u', ' ', $out));
    }

    private static function inlineEnvironment(): Environment
    {
        $environment = new Environment(self::CONFIG);
        $environment->addExtension(new InlinesOnlyExtension);
        $environment->addExtension(new StrikethroughExtension);
        $environment->addEventListener(DocumentParsedEvent::class, function (DocumentParsedEvent $event): void {
            self::unwrap($event->getDocument(), [Link::class, Image::class]);
        });

        return $environment;
    }

    private static function blockEnvironment(): Environment
    {
        $environment = new Environment(self::CONFIG + [
            'external_link' => [
                'internal_hosts' => [],
                'open_in_new_window' => true,
                'nofollow' => 'external',
                'noopener' => 'external',
                'noreferrer' => 'external',
            ],
        ]);
        $environment->addExtension(new CommonMarkCoreExtension);
        $environment->addExtension(new GithubFlavoredMarkdownExtension);
        $environment->addExtension(new ExternalLinkExtension);
        $environment->addEventListener(DocumentParsedEvent::class, function (DocumentParsedEvent $event): void {
            self::unwrap($event->getDocument(), [Image::class]);
        });

        return $environment;
    }

    /**
     * Replace every node of the given classes by its children: a link by its
     * text, an image by its alternative text.
     *
     * @param  list<class-string<Node>>  $classes
     */
    private static function unwrap(Document $document, array $classes): void
    {
        $found = [];
        $walker = $document->walker();
        while ($event = $walker->next()) {
            $node = $event->getNode();
            if ($event->isEntering() && in_array($node::class, $classes, true)) {
                $found[] = $node;
            }
        }

        foreach ($found as $node) {
            while (($child = $node->firstChild()) !== null) {
                $node->insertBefore($child);
            }
            $node->detach();
        }
    }
}
