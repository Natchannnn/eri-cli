---
title: "I Took My Email Off the Page and Killed My Own Logo"
date: 2026-06-21
category: Projects
summary: "Replacing raw email markup with a FormSubmit AJAX endpoint, implementing client-side blog filtering, and evaluating then reverting an experimental network-port logo mark."
---
Spent today on privacy and small UX stuff in production.

My contact form had my raw email sitting right in the HTML action. That's just asking scrapers to find it. Moved it to a masked FormSubmit alias — no email address in the markup at all now. Switched submits to their `/ajax/` endpoint with `fetch()`, checking JSON status, showing errors inline instead of a full page redirect.

## Blog Filtering

Archive was just a flat chronological wall. Added client-side category filtering — click a tag pill, matching cards stay, rest hide. No reloads, no extra routes.

Had two dumb bugs: the active-filter banner stuck around with nothing selected, and empty tag states wouldn't reset. Fixed both.

## The Logo That Didn't Survive the Header

Header and footer had a generic rotated square. I tried replacing it with something mine: an 'N' built out of RJ-45 jack outlines with little LED link lights on top.

Looked great as a solo SVG. In the actual nav? Terrible. The descender crowded the LEDs at small sizes, and it carried way too much visual weight next to the type. Ripped it out of every template, put the neutral placeholder back. The vector is still sitting in `assets/` — maybe I'll fix the typography later.

Pushed the FormSubmit handler, the filter logic, and the copy updates to prod after the revert. Still owe it an end-to-end test submission through the masked endpoint.
