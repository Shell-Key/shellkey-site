# Shell Key store — what changed and what to do next

## New files

```
store.html               the catalog
request.html             the request / priority-build form
products/*.html          35 detail pages, one per item
assets/store.css         store styling (extends your styles.css, overrides nothing)
assets/site.js           shared JS — nav, image viewer, both forms
build_store.py           regenerates everything from one product list
```

## Changed files

- **index.html** — added *Store* to the nav and a "Visit the Store" button in the
  hero. The inline `<script>` block moved to `assets/site.js` so all pages share
  one copy. Behaviour is identical.
- **assets/styles.css** — untouched.

## Two things to do before you publish

**1. Replace the PayPal placeholders.** Open `build_store.py`, search for
`PAYPAL_LINK_`, and paste your real button URLs over the seven placeholders (the
guides — those are the items you can deliver today). Then re-run
`python build_store.py`.

**2. Check the prices.** Every price in the file is a starting point, not a quote.
The dashboard prices, the build ranges, the course prices — all of it needs your
judgment before it goes live. You know this market; I don't.

## How the three states work

| State | Shows | Button goes to |
|---|---|---|
| `available` | Available Now | Your PayPal link |
| `soon` | Coming Soon + "planned price" | `request.html?item=slug` |
| `quote` | By Quote | `request.html?item=slug` |

Right now: **7 available, 16 coming soon, 9 by quote.**

The seven guides you already sell are live. Everything else routes to the request
form until you build it — so nothing takes money for something you can't deliver.

## The request form

Captures name, company, email, phone, full address, what they're looking for,
timeframe, and a **priority checkbox** for people who need it built now. The
product they clicked from is pre-selected automatically via `?item=`.

It composes an email and opens their mail app — same approach as your existing
contact form, no backend needed. A `PRIORITY REQUEST:` subject line makes the
urgent ones obvious in your inbox.

**Worth upgrading later:** mailto forms lose people whose browser has no mail app
configured — on a purchase-intent form that's real money. When you're ready,
[Formspree](https://formspree.io) or [Web3Forms](https://web3forms.com) will post
it properly for free; it's a one-line change to the form tag in `build_store.py`.

## Adding or changing products

Everything lives in the `PRODUCTS` list in `build_store.py`. Copy a block, edit
it, re-run. A product needs: `slug`, `cat`, `name`, `tagline`, `img`, `price`,
`status`, `short`, `bullets`, and `detail` (four heading/paragraph pairs).

```bash
python build_store.py
```

That rewrites `store.html`, `request.html` and every product page. Don't hand-edit
the generated files — your changes get overwritten on the next run.

## Two bugs fixed while I was in there

- **Body links were invisible.** `styles.css` never set a link colour, so email
  and phone links fell back to browser-default blue on your navy background. They
  now use your neon green. This fixed your existing contact section too.
- **Textareas rendered in monospace** because they don't inherit `font-family`.

## Which images went where

Your real dashboard screenshots carry the wall chart products — `001-ProjectSummary`
through `008-DailyLog`, plus `Dash1` and both wall charts. Those screenshots are
the strongest sales asset on the site: they're visibly real work, not stock art.
The stock `cards/digital*` images fill in for the training and guide products,
which have no screenshot of their own yet.

When you build each product, swap in a real screenshot. A photo of the actual
thing outsells a stock image every time in this industry.
