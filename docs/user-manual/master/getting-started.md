---
layout: default
title: 1. Getting started
parent: Master manual
grand_parent: User Manual
nav_order: 1
---

# 1. Getting started
{: .no_toc }

1. TOC
{:toc}

## Signing in

The panel is at `/admin` on the inventory's address; the address itself redirects there. You need an account that is verified, approved, not suspended, and holds a role. A user manager creates it, or approves it if self-registration is open, and gives it its role ([Users and roles]({{ '/user-manual/master/users-and-roles' | relative_url }})).

![The sign-in page]({{ '/user-manual/images/sign-in.png' | relative_url }})

1. Enter your **e-mail address** and **password**, then select **Sign in**.
2. Tick **Remember me** only on your own computer.
3. If you forgot your password, select **Forgot password?** The panel sends a reset link to your e-mail address. If two-factor authentication is on for your account, the reset asks for a code too.

If your e-mail address is not verified yet, or a user manager has not approved your account yet, the sign-in page says so. It sends a new verification link when one is needed.

### Two-factor authentication (MFA)

The panel protects every account with a second factor.

**The first time you sign in**, the panel opens the two-factor setup page:

1. Scan the QR code with an authenticator app on your phone (any TOTP app, such as Microsoft Authenticator, Google Authenticator or 1Password).
2. Enter the six-digit **Authenticator Code** the app shows, then select **Confirm Setup**.
3. The panel then shows your **recovery codes**. Store them somewhere safe, away from your phone: each one lets you in once if you lose the phone.

**Every later sign-in** asks for a code after your password. Choose the **verification method**:

| Method | When to use it |
|---|---|
| **Authenticator app** | Normally. Enter the code the app shows. |
| **Recovery code** | You don't have your phone. Each code works once. |
| **Email code** | Select **Send code to my email**, then enter the six-digit code from the message. |

You can't turn two-factor authentication off yourself. If you have lost both your phone and your recovery codes, ask a user manager to reset it; you set it up again at your next sign-in.

### Your profile and connected apps

The round button with your initial, at the top right, opens the user menu:

- **Profile**: your name and e-mail address, **Change Password**, **Regenerate Recovery Codes** (the old ones stop working), and **Log Out Other Browser Sessions**. Changing your e-mail address means verifying the new one before you can sign in again.
- **Connected apps**: applications you approved to act for you, for example an AI assistant connected to the inventory's read-only MCP server ([MCP]({{ '/mcp' | relative_url }})). **Revoke** ends an app's access at once. See [Connected apps]({{ '/user-manual/master/users-and-roles' | relative_url }}#connected-apps) for approving an app.
- **Sign out**.

## The dashboard and the menu

After signing in you land on the **Dashboard**. It shows counts, the storage used by images, the images still waiting in the pool, and the items edited most recently.

![The dashboard with the menu on the left and the global search at the top]({{ '/user-manual/images/dashboard.png' | relative_url }})

The menu on the left groups the panel's pages:

| Group | Entries you will use |
|---|---|
| **Inventory** | Browse collection tree, Items, Collections, Publications, Partners, Projects, Item Links, Timelines, Timeline Events, Browse timeline tree, Contributors, Browse item tree |
| **Shared Data** | Contexts, Tags, Authors, Glossaries, Artists, Dynasties |
| **Available Images** | Available Images: the pool of uploaded images waiting to be attached |
| **Translations** | Item Translations, Collection Translations, Partner Translations, Publication Translations: every translation in one list, with filters |
| **Reference Data** | Languages, Countries |
| **Administration** | Users, roles, registration settings and the audit log (user managers only) |

What you see depends on your role, and you hold exactly one. A *Visitor* can read everything, reference data included, but change nothing. A *Manager of Data* can read, create, change and delete all content, reference data such as Artists and Dynasties included. A *Manager of Users* manages accounts and their role, and sees no content; the *Superadmin* also manages the other user managers. A button you are not allowed to use is not shown. [Users and roles]({{ '/user-manual/master/users-and-roles' | relative_url }}) has the details.

### The pages of a record

Every kind of record works the same way:

- The **list** page (for example **Items**) has a search box, **filters** (the funnel icon), a column picker, and sortable column headings. Select a row to open the record.
- The **view** page shows the record's fields in sections, then its related records in **tabs** under them: its translations, images, collections and so on. Each tab is a small table with its own buttons (**Create**, **Attach**, **Edit**, **Detach**…).
- **Edit** (top right of the view page) opens the record's form. Nothing is saved until you select **Save changes**; **Cancel** leaves without saving.
- **Delete** removes the record. Prefer **Detach** when you only want to take a record out of a list: detaching removes the link and keeps both records.

Sections such as **System Information** are folded; select the heading to unfold them. They hold the record's UUID, internal name, legacy code and dates. You rarely need them, except to tell the team which record you mean: copy the UUID or the legacy code.

## Finding records

### The global search

The **Search** box at the top of every page searches items, collections, partners and the other main records at once, by name, internal name, legacy code or UUID. Results are grouped by kind of record. Select one to open it.

![Global search results grouped by kind of record]({{ '/user-manual/images/global-search.png' | relative_url }})

Several records can share a name: for example *Aleppo* is a location in Explore, in the Travels trails and elsewhere. When the results are ambiguous, open the list page of that kind of record and filter it instead.

### Lists and filters

The list pages are the most precise way to find records. On **Items**, the filters include the item type, partner, collection, project, country and tag, the top-level items only, and the **translation coverage**: items that have, or lack, a translation in a language or a context. For example, to find the objects of a gallery that have no French text: filter **Collection** on the gallery and **Translation language missing** on French.

### The tree browsers

Three pages show the inventory as trees. Select the arrow in front of a row to open it.

- **Browse collection tree** starts from the root collections (*Discover Islamic Art*, *Sharing History*, *EXPLORE with MWNF*, *Exhibitions*, *Galleries*, *Travels*…) and opens down to themes, itineraries and locations. Filter it to show collections with children only, or with items only.

  ![The collection tree with Discover Islamic Art opened]({{ '/user-manual/images/collection-tree.png' | relative_url }})

- **Browse item tree** shows top-level items with their children: an object with its pictures, a monument with its details and pictures. Filter it by type, project and country, or search by name or legacy code.

  ![The item tree: the Aleppo Room and its three pictures]({{ '/user-manual/images/item-tree.png' | relative_url }})

- **Browse timeline tree** shows each timeline with its events. Filter it by country or by the collection it belongs to.

Selecting a row's name opens the record.
