# DictionaryRoot Product Header and Footer Refinement v1

## Objective

Clarify the customer-facing product hierarchy without changing the live DictionaryRoot API, search ranking, URL state, editorial permissions, or identity model.

## Product hierarchy

Primary navigation remains focused on the customer journey:

- Home
- Concepts
- Sphere
- Sources
- History

Operational experiences move under **Manage**:

- Coverage
- Editorial
- Accounts

The authenticated identity remains visible at the far-right edge. The identity menu exposes role context, Accounts and access, and sign out.

## Context and platform attribution

Meaning and source context is presented as a breadcrumb below the sticky header. Platform attribution is removed from the crowded header and placed in the bottom-right page footer. The footer also reports whether SourceRoot is connected or offline; it does not insert fallback data.

## Responsive behavior

- Full single-row header on wide desktop.
- Navigation moves to a separate row from 1101px through 1479px.
- Mobile menu activates at 1100px and below.
- Sign in or the current identity remains visible outside the mobile menu.

## Compatibility

This stage replaces only the shared navigation CSS and JavaScript. Existing pages continue to use their current HTML, API client, data, routes, and experience-specific assets.
