---
layout: default
title: ADR 004 — Publication PDFs on the document pipeline, served at /doc
parent: Architecture Decisions
nav_order: 4
---

# ADR 004 — Publication PDFs on the document pipeline, served at /doc

- **Status:** Proposed (Pascal validates it before any code: #2547)
- **Date:** 2026-11-12
- **Milestone:** M14 — Include Books and Travels legacy sites in the inventory (#2512 B7 #2547, #2513 C7 #2548)

## Context

Pascal decided (D-P6, #2517) that the publications' sample and credits PDFs are imported now, not left on the legacy server. Legacy keeps them per edition (`books.path_catalogue`, `books.path_credits`).

What the inventory already has for PDFs (M7 Story A4.2, #1906, `docs/frontend-filament/document-upload.md`):

- `DocumentUpload` on the private `local` disk (`document_uploads/`), validated on the queue by `DocumentUploadListener` (PDF only, size range, MIME guessed from the bytes);
- the private `document-originals` disk (`documents/`), never web-reachable;
- `ItemDocument` with `DeletesDocumentFileOnDelete`, `documents:cleanup-orphans`, `documents:cleanup-pending`;
- an API that serves an item document only to a signed-in user with the right permission.

What it does not have:

- **No public URL.** The design says documents "are never burned or served publicly". The sites can reach only `/pub`, which serves images.
- **No document sync.** `item-document` (phase 08) writes 23 Sharing History `item_documents` rows with a size placeholder, but no tool copies their files, and `ship` pushes only the image originals.

## Decision

1. **The publication PDFs use the existing document pipeline.** That means a new `PublicationDocument` model built like `ItemDocument`:
   - columns: `publication_id`, `publication_edition_id` (nullable, null on delete), `language_id`, `kind` (`sample`, `credits`), `path`, `original_name`, `mime_type`, `size`, `display_order`, `backward_compatibility`, `extra`;
   - the same disks: pending on `local`, originals on `document-originals`;
   - the same `DeletesDocumentFileOnDelete` trait, the same validation and the same cleanup commands.

   `DocumentUpload` gains a nullable `publication_id` beside `item_id` (exactly one of them set), and `DocumentUploadListener` creates the matching document. No second pipeline is written.
2. **A public, stable URL: `/doc/{filename}`.** It is registered like `/pub` (outside the web group: no session, no cookie, no CSRF) and has its own throttle.
   - It serves **only `PublicationDocument`** files: their owner is a published work and the sites link to them. `ItemDocument` stays private, as before.
   - The file is streamed as stored. It is not stamped: unlike a picture, a PDF carries its own printed credits, and the site shows the copyright line beside the link.
   - Headers:
     - `Content-Type: application/pdf`;
     - `Content-Disposition: inline; filename="<original name>"`;
     - `X-Content-Type-Options: nosniff`;
     - `Content-Security-Policy: sandbox`;
     - `Cache-Control: public, no-cache`, with an ETag of the file's size and checksum.
   - The filename is the stored name (a UUID), validated by a pattern ending in `.pdf`. Anything else is a 404, as on `/pub`.
3. **Import: a document sync, and ship pushes the documents.**
   - A `document-sync` tool, like `image-sync`, copies each document row's legacy file from the mirrored legacy share into a `inventory-staging-documents` volume as `<uuid>.pdf`, and sets the real `size`. It also gives the 23 Sharing History item documents their files.
   - `ship` pushes that volume to the `document-originals` disk with the same rsync rules as the image originals (`--delete`, `D2770,F660`).
   - A row whose legacy file is missing is logged as "legacy document not found" and keeps its placeholder size.
4. **Exports.** The Publications package lists each edition's documents as `{kind, language, url: <base>/doc/<filename>, size}`. No other package exports documents.

## Consequences

- One pipeline for every PDF; the private originals rule of CLAUDE.md applies to documents as it does to images.
- CLAUDE.md gains a short "Document pipeline" section (disks, `/doc` serves `PublicationDocument` only, never the public disk).
- The Sharing History item documents get their files on the next reimport. They stay private.
- `/doc` is a second public file route. Its tests cover: only publication documents, PDFs only, the headers, the throttle, no cookie.

## Alternatives considered

- **Link to the legacy files.** Pascal ruled it out (D-P6: import now), and the links die when books.museumwnf.org moves.
- **Put the PDFs in the npm package.** Packages would grow by the size of every PDF on each publish, and npm is not a file host.
- **Serve them through `/pub`.** `/pub` means "burned image rendition"; a PDF has neither a rendition nor a burn. One route per kind keeps each rule simple.
- **Stamp the copyright into the PDF.** Rewriting PDFs on the fly adds a PDF library and a cache for no visible gain: the sample pages are already printed with their credits.
