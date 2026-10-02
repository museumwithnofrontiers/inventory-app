---
layout: default
title: Inventory Principles
parent: Understanding the Inventory
nav_order: 1
---

# Inventory Principles

MWNF Inventory replaces several overlapping legacy systems with one content base. The goal is not to reproduce each old application. The goal is to preserve museum content in a stable model that all MWNF applications can use.

## The central decision

The Inventory stores content. It does not store every concern that legacy systems mixed into the same databases.

Content includes:

- objects and monuments;
- details and pictures;
- partners and contributors;
- collections, exhibitions, galleries, trails, itineraries, regions, and locations;
- translations, glossary entries, timelines, links, tags, images, media, and documents.

The Inventory excludes application-only concerns such as website layout settings, old navigation configuration, server configuration, local client behavior, and temporary operational data.

## One content base, many applications

Legacy applications often keep their own representation of content. Inventory reverses that pattern. The same content record can serve the back-office, management API, future read-only API, and public front-end clients.

This makes content validation more important than application imitation. When you validate the import, check whether the content is correct in the Inventory model, not whether the old tables have been copied one by one.

## One record can appear in many places

An object can belong to a project collection and also appear in a gallery, itinerary, thematic cycle, or related-content list. The Inventory keeps one Item and connects it to those places through Collections, Item Links, Tags, and parent-child relationships.

This removes unnecessary duplication while preserving editorial structure.

## Text depends on language and context

The same content can have different text for different languages and editorial contexts. A context describes the purpose of the text, such as default content, a project context, Explore, Travels, or a Thematic Gallery context.

Language answers "Which language is this?" Context answers "For which use is this text written?"

## Legacy identity remains visible

Imported records keep a `backward_compatibility` value. This value names the source database, table, and key values that produced the Inventory record.

Use this value during validation. It is the clean bridge between the new model and the legacy systems.

## The back-office is Filament

The back-office is `/admin`, built with Filament, and it is the application's only user interface: `/` redirects to it. The earlier Blade/Livewire interface under `/web` was retired in milestone M8; see [ADR 003](../adr/003-filament-only-admin).

The management API remains maintained, but it is not the primary human interface.
