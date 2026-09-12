---
title: "Masking Contact Form Endpoints, Adding Blog Category Filters, and Reverting a Header Logo"
date: 2026-06-21
category: Projects
summary: "Replacing raw email markup with a FormSubmit AJAX endpoint, implementing client-side blog filtering, and evaluating then reverting an experimental network-port logo mark."
---
Auditing production assets addressed privacy exposure in the contact form, introduced dynamic tag filtering on the blog, and evaluated a custom brand identity mark.

## Obfuscating Contact Form Endpoints

The initial portfolio contact form included a raw email address in the HTML action attribute. Even on an indexed site, exposing raw mailto links invites automated harvesting.

The implementation was upgraded:
- The form action was moved to a masked FormSubmit alias, removing direct email addresses from client-side markup entirely.
- Form submissions were switched to the FormSubmit `/ajax/` endpoint using `fetch()`, verifying JSON response status codes and presenting user-facing error states without full page redirects.

## Client-Side Blog Category Filtering

As article volume expanded, browsing the flat chronological list became inefficient. Client-side tag filtering was added to the archive:
- Article metadata cards and category pills were bound to active category filters.
- Clicking a category tag isolates matching articles in-place without triggering full page reloads or requiring separate route manifests.
- Initial UI defects—such as an active filter banner persisting when no tags were selected, or empty tag states failing to reset—were corrected.

## Evaluating and Reverting Brand Mark Iterations

The site header and footer previously used a generic rotated square motif. An alternative mark was designed based on physical networking symbolism: an 'N' glyph structured from RJ-45 jack outlines, featuring simulated LED link lights above the ports.

While technically sound as a standalone vector illustration, integrating the glyph across navigation bars revealed optical balance issues:
- The descender of the letter crowded the LED accent points at small viewport scales.
- In-situ review across header and footer elements showed excessive visual weight compared to the typographic layout.

The change was reverted across all templates, restoring the neutral placeholder mark while archiving the vector asset in `assets/` for future typography refinement.

## Production Deployment

Following the logo reversion, verified changes—including the FormSubmit AJAX handler, category filter logic, and updated project copy—were deployed to production.

## Pending Verification

- Send an end-to-end test submission through the masked FormSubmit endpoint.
- Verify archive category filtering behavior when JavaScript execution is disabled.
