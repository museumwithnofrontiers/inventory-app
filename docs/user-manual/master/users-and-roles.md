---
layout: default
title: 9. Users and roles
parent: Master manual
grand_parent: User Manual
nav_order: 9
---

# 9. Users and roles
{: .no_toc }

Who may do what in the panel, and how the people who manage accounts do their work. The first section is for everyone; the rest is for the user managers. The rules are recorded in [ADR 007]({{ '/adr/007-authorization-model' | relative_url }}).

1. TOC
{:toc}

## The four roles

Every account holds **exactly one role, or none**. An account without a role can sign in to nothing. Nobody holds a permission of their own: the role carries them all.

| Role | What it may do |
|---|---|
| **Visitor** | Reads everything in the inventory: items, collections, partners, images and their original files, item documents, reference data (tags, artists, dynasties, glossary, languages…). Changes nothing: the panel shows no button that would save, attach, detach, upload or delete. |
| **Manager of Data** | Reads, creates, changes and deletes all inventory data, reference data included. Has no access to accounts. |
| **Manager of Users** | Manages accounts and their role, the self-registration switch and the pending registrations, and reads the audit log. Has **no access to inventory data**, not even to read it. |
| **Superadmin** | Everything a Manager of Users does, and also manages the other Managers of Users. Exactly one person holds it. |

Every role may also use the inventory's read-only MCP server and approve apps for it ([Connected apps](#connected-apps)).

The Manager of Users role is a **break-glass** role: it exists to fix accounts, not to edit content. A person who maintains content and also manages accounts needs two separate accounts.

A button you are not allowed to use is not shown, and a page you may not open is not in your menu. The same rules apply to the REST API and the MCP server: the panel, the API and the MCP server ask the same policies.

### What everyone can do on their own account

Whatever your role, your **profile** (the round button with your initial, top right) lets you change your name, your e-mail address and your password, regenerate your recovery codes, sign out your other browser sessions and see your connected apps.

- Changing your **e-mail address** clears its verification: you must open the verification link sent to the new address before you can sign in again.
- **Two-factor authentication can't be turned off** by its owner: every role holds the panel access permission, which requires it. Only a user manager can reset it ([Accounts](#working-on-an-account)).
- **Nobody deletes their own account.** A user manager deletes accounts ([Accounts](#working-on-an-account)); the Superadmin's account is deleted by nobody in the panel.

## Connected apps

An app such as an AI assistant connected to the inventory's MCP server, or a program using the REST API, never receives your password. It asks you to approve it in the panel, and then acts **as you**: with your role, never more.

### Approving an app

When an app asks for access, your browser opens the panel:

1. Sign in, with your second factor, if you aren't signed in yet.
2. The approval page shows **which app** wants to use your account, the e-mail address you are signed in with, **what it may do** (its scopes: browse the inventory through the MCP server, read data through the REST API, change data through the REST API), and the address your answer goes back to.
3. Select **Approve**, or **Deny**.

The panel asks **every time** an app asks for access, even for an app you approved before. In practice an app asks again when its access lapses.

A scope only limits the app. An app allowed to "change data through the REST API" still changes nothing for a Visitor: your role decides.

### Seeing and revoking your apps

**Connected apps** (in the user menu, or on your profile) starts with the address of the inventory's **MCP server**: give it to an AI assistant, such as Claude, to let it browse the inventory with your permissions. The copy button next to it copies it. The assistant then asks you to sign in and approve it, as above.

![The Connected apps page, before any app was approved]({{ '/user-manual/images/connected-apps.png' | relative_url }})

Under it, the page lists the apps you approved: what each **may** do, when you **authorized** it and when it was **last active**. **Revoke** cuts an app off at once; it has to ask for your approval again.

When a user manager **suspends** your account, every app you approved is cut off with your sessions. Reactivating the account doesn't bring them back: each app asks for your approval again.

## For user managers

The **Administration** group of the menu is visible to the Managers of Users and the Superadmin only.

| Entry | What it is |
|---|---|
| **Users** | Every account: name, e-mail, role, whether the e-mail is verified, whether two-factor authentication is set up, when it was approved, whether it is suspended. Filters find accounts by role, without a role, pending approval or suspended. |
| **Pending Registrations** | The accounts that registered themselves and wait for approval. |
| **Self-Registration** | The switch that opens or closes the registration page. |
| **Roles** | The four roles and their permissions, read-only: they are defined in the application's code. |
| **Audit Log** | Everything that happened to accounts ([The audit log](#the-audit-log)). |

### What you may not do

- **Nobody changes their own role**, suspends or deletes themselves, on the **Users** list or on their profile.
- **Only the Superadmin** changes another Manager of Users, or gives someone the Manager of Users role.
- **Nobody changes the Superadmin's account** in the panel. Its holder uses their own profile. The role moves to another person only with a command on the server, run by the development team (`php artisan user:superadmin`, see [Command-line user management]({{ '/deployment/command-line-user-management' | relative_url }})).
- The **Superadmin role is never given** in the panel.

The role select only offers the roles you may give. Changes to an account ask for **your own password** again: creating or editing an account, changing a role, resetting two-factor authentication, suspending, reactivating or deleting.

### Creating an account

1. **Users → New user**. Enter the person's **name** and **e-mail address**, and choose their **role**, or leave it empty (no access yet).
2. Confirm with your password, then select **Create**.
3. The panel approves the account and sends an **invitation**: a link to choose a password, valid 60 minutes. **Send Invitation** on the account's row sends a new one.
4. The person must also **verify their e-mail address**: when they first sign in, the sign-in page sends them a verification link. If you know the address is right, **Mark Email Verified** does it for them.

### Approving a self-registration

When **Self-Registration** is on, anyone can create an account on the sign-in page. The account can't be used until it is verified, approved and given a role:

1. The person verifies their e-mail address from the link they receive.
2. In **Pending Registrations**, select **Approve**, or **Reject** to delete the account. You can approve before the person has verified their address, but the account still needs that verification.
3. On **Users**, select **Change Role** on the account and give it a role. Approving gives none.

### Working on an account

The actions at the end of each row of **Users**:

| Action | What it does |
|---|---|
| **Edit** | Name, e-mail, password and role. |
| **Change Role** | One role, or none. Taking the role away removes all access. |
| **Resend Verification**, **Mark Email Verified**, **Clear Email Verification** | Manage the e-mail verification. |
| **Send Invitation** | Sends a link to choose a new password. |
| **Disable Two-Factor** | For someone who lost both their phone and their recovery codes. They set it up again at their next sign-in. |
| **Approve** | Approves a pending account. |
| **Suspend** | The person can no longer sign in, and their sessions and connected apps are signed out at once. |
| **Reactivate** | Lifts a suspension. Their apps must be approved again. |
| **Delete** | Deletes the account. It can't be undone. Prefer **Suspend** while in doubt. |

Several accounts can be approved, suspended or given a role at once: select them, then use the bulk actions above the table.

### The audit log

**Audit Log** lists, newest first, **when** something happened, **who** did it, through which **channel** (the panel, a command on the server…), the **action** and its **subject**. Opening an entry shows the IP address and the changed values.

It records every change to an account and to its role (creation, approval, suspension, reactivation, two-factor reset, deletion), every revocation of sessions and apps, every synchronisation of the roles, and every account or permission command run on the server, with the server account that ran it. Nobody can change or delete an entry.
