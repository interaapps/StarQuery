# OpenID Connect (OIDC)

StarQuery supports optional OpenID Connect login in hosted mode.

This page explains:

- how the OIDC login flow works
- what StarQuery uses OIDC for
- how authorization works after login
- how to keep unauthorized users out

## What OIDC Does In StarQuery

OIDC in StarQuery is used for identity and sign-in.

It answers:

- who is this user?
- has this user successfully authenticated with the configured identity provider?

OIDC does not automatically decide what the user is allowed to do inside StarQuery. Access inside StarQuery is still controlled by StarQuery users, roles, and permission patterns.

## Availability

OIDC is only available in hosted mode.

Set these environment variables to enable it:

- `STARQUERY_AUTH_OPENID_ISSUER`
- `STARQUERY_AUTH_OPENID_CLIENT_ID`
- `STARQUERY_AUTH_OPENID_CLIENT_SECRET` if your provider requires one
- `STARQUERY_AUTH_OPENID_SCOPES` if you want to override the default scopes

The default scopes are:

```text
openid profile email
```

See also:

- [Hosted Configuration](/deploy/hosted-configuration)
- [Configuration Reference](/reference/configuration)

## Login Flow

When a user starts an OpenID login:

1. StarQuery discovers the provider configuration from the configured issuer.
2. StarQuery creates an authorization request with:
   - `state`
   - `nonce`
   - PKCE values
3. The user is redirected to the identity provider.
4. After the provider authenticates the user, the browser returns to StarQuery's callback URL.
5. StarQuery validates the callback state and exchanges the authorization code for tokens.
6. StarQuery reads identity claims from the returned token set.
7. StarQuery creates a StarQuery session token and redirects the browser back to the app.

StarQuery expects the OpenID response to include at least:

- `sub`
- `email`

If either claim is missing, login is rejected.

## How User Matching Works

After a successful OpenID callback, StarQuery tries to match the user in this order:

1. existing user by OpenID subject
2. existing user by email
3. otherwise create a new StarQuery user

When StarQuery creates a new user from OIDC, that user is created with:

- `authProvider: openid`
- the external subject from the provider
- no built-in admin access
- no direct permissions by default

That means a successful OIDC login does not automatically grant broad access inside StarQuery.

## Authorization After Login

After login, StarQuery authorizes requests with its own permission model.

That model is based on:

- user permissions
- role permissions
- wildcard permission patterns

Examples include project and datasource permissions such as:

- `project.view.{projectId}:read`
- `project.manage.{projectId}:write`
- `datasource.query.{projectId}.*:read`

If a user is authenticated but lacks the required permission, StarQuery returns `403 Forbidden`.

See [Permissions Reference](/reference/permissions).

## Important Security Behavior

The most important thing to understand is this:

An unknown user who can successfully authenticate with the configured OpenID provider can currently be auto-provisioned as a StarQuery user.

In practice, that means:

- OIDC can create a StarQuery account for a new user
- that user does not automatically become an admin
- that user may still have little or no access inside StarQuery
- but they are still able to sign in and exist as a user record

If your requirement is "only explicitly approved users should be able to get into StarQuery at all", then provider-side restrictions are essential.

## How To Keep Unauthorized Users Out

The safest setup is layered.

## 1. Restrict Access At The Identity Provider

This is the primary control.

Only users who should be allowed into StarQuery should be able to authenticate against the OIDC app registration. Depending on your provider, that usually means one or more of:

- assign the application only to approved users
- restrict sign-in to a specific group
- restrict sign-in to a specific organization or tenant
- limit who can consent to or use the client

If users are blocked at the provider, they never reach the StarQuery session creation step.

## 2. Use Least-Privilege Roles In StarQuery

Even for approved users, avoid broad permissions unless they are needed.

A good pattern is:

- keep only a small number of admins
- assign read or write access per project
- avoid `*` except for trusted administrators

## 3. Disable Users When Needed

StarQuery can disable a user account. Disabled users cannot authenticate successfully into an active session even if their identity provider authentication succeeds.

This is useful when:

- someone should no longer have access
- you need to revoke access before changing provider-side assignments
- a previously auto-provisioned user should be blocked

## 4. Seed A Known Admin

Use the seed admin settings for a controlled first admin account:

- `STARQUERY_SEED_ADMIN_EMAIL`
- `STARQUERY_SEED_ADMIN_PASSWORD`
- `STARQUERY_SEED_ADMIN_NAME`

This ensures you have a known administrative path before relying on OIDC-managed users.

## 5. Set `STARQUERY_PUBLIC_URL` Correctly

In hosted deployments, set `STARQUERY_PUBLIC_URL` to the real external StarQuery URL.

This helps StarQuery build the correct callback and same-origin return URLs for hosted authentication flows.

## Recommended Operating Model

For most production deployments, a good model is:

1. allow OIDC only for a controlled set of people at the identity provider
2. use a seeded admin for initial setup and emergency access
3. assign StarQuery roles and permissions separately from identity
4. disable unneeded StarQuery users promptly

## Current Limitation

StarQuery does not currently use OpenID group claims, role claims, or domain allowlists as a first-class authorization layer during login.

So if you need behavior like:

- only pre-provisioned users may sign in
- only users from specific email domains may sign in
- only users in a specific identity-provider group may sign in

you should currently enforce that at the identity provider, or customize the StarQuery login flow.

## Related Pages

- [Hosted](/deploy/hosted)
- [Hosted Configuration](/deploy/hosted-configuration)
- [Configuration Reference](/reference/configuration)
- [Permissions Reference](/reference/permissions)
