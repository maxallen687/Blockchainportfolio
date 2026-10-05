# Blockchain Engineer Portfolio

A fast, dependency-free, single-page portfolio for a senior blockchain / smart-contract engineer, designed to turn visitors into clients.

No framework, no build step, no trackers, no cookies. Open it, edit the HTML, deploy anywhere (including IPFS + ENS).

## Highlights

- **Live Ethereum data.** The hero card shows the latest mainnet block, base fee and a 20-block sparkline, polled every 12 s from keyless public RPCs. If they're unreachable it switches to a clearly labelled "Simulated" estimate.
- **Real proof of craft.** The hero terminal replays a genuine `forge test` / `forge coverage` run of the code shown further down the page.
- **Interactive code walkthrough.** A Solidity contract, its Foundry fuzz tests and a viem/wagmi React hook, with notes that highlight the lines they describe. The contract compiles with solc 0.8.28 + OpenZeppelin 5, both fuzz tests pass at 10,000 runs, coverage is 100%, and the hook type-checks under `tsc --strict`.
- **Conversion-focused structure:** availability badge, outcome-led headline, proof stats, services, stacked case studies, testimonials, process, engagement models, FAQ and a lead-qualifying contact form (needs + budget), plus a sticky "Start a project" bar on mobile.
- **Delight without the bloat:** ⌘K / Ctrl+K command menu, cursor spotlight cards, peer-to-peer network canvas that pulses on each new block, copy-to-clipboard.
- **Quality checked:**

  | Lighthouse (gzip-served) | Performance | Accessibility | Best practices | SEO |
  | --- | --- | --- | --- | --- |
  | Desktop | 100 | 100 | 100 | 100 |
  | Mobile (simulated slow 4G) | ~90 | 100 | 100 | 100 |

  axe-core reports 0 WCAG 2.1 AA violations. Full keyboard support, `prefers-reduced-motion` support, and every piece of content stays visible with JavaScript disabled.

## Quick start

```bash
cd "Blockchain portfolio"
python3 -m http.server 8080      # or: npx serve .
# open http://localhost:8080
```

Opening `index.html` directly also works. A local server is closer to production, though. In VS Code, the *Live Server* extension works too.

## Before you publish: make it yours

Everything personal is a placeholder. **The projects, metrics, stats and testimonials are realistic samples that show the layout. Replace them with your real work, or delete them.** Never publish numbers or quotes you can't back up; clients and auditors check.

**Already set:** name (Max Allen), email (maxallen03919@gmail.com), time zone (Asia/Singapore, shown as "SGT (UTC+8)"), GitHub (github.com/maxallen687) and Telegram (@maxallen919).

Search `EDIT:` in `index.html` to jump between editable blocks, then find-and-replace the remaining placeholders:

| Replace | With | Where it appears |
| --- | --- | --- |
| `yourdomain.com` | your domain | canonical/OG URLs, JSON-LD, `robots.txt`, `sitemap.xml` |
| `cal.com/yourhandle/discovery` | your booking link | contact card, footer, command menu |
| `Q4 2026` / `November 2026` | your availability | hero pill, mobile menu, mobile bar, profile, FAQ, OG image |

Sample content is labelled with an amber "Sample" chip, driven by a `data-sample` attribute on the block. Delete the attribute once a block holds your real content, and the chip disappears.

Then work through the content:

- [ ] **Stats** (hero): edit each `data-count` / `data-prefix` / `data-suffix` and its label.
- [ ] **Projects** (`#work`): four `<article class="work-card">` blocks. Copy one to add more; `--i` sets the stacking order and `--c1`/`--c2` set its accent colours. The "Request the full case study" link pre-fills the contact form.
- [ ] **Testimonials** (`#testimonials`): real quotes with permission, or remove the section.
- [ ] **About**: bio paragraphs, principles, toolbox chips, experience line.
- [x] **Time zone**: `data-tz="Asia/Singapore"` drives the live "Local time" clock; `data-tz-label` controls how the zone is shown.
- [ ] **Photo**: replace the "MA" monogram with `<img src="assets/img/avatar.jpg" alt="Max Allen">` inside `.profile__avatar` (a square ~400 px image).
- [ ] **Gas card** (services): swap the sample before/after numbers for a real optimisation you've done.
- [ ] **Engagement models / FAQ**: adjust timelines and answers to how you actually work.
- [ ] **Hero terminal**: optionally paste output from one of your own repos into `#terminal-output`. Lines with `data-cmd` are typed out; `data-delay` is the pause (ms) before each output line.
- [ ] **Social preview**: update `tools/og-image.html`, then regenerate the PNG (see below).

## Contact form

By default, submitting opens the visitor's email app with a pre-filled message, so no backend is needed. To receive submissions directly:

1. Create a form at [Formspree](https://formspree.io) (or Web3Forms, Basin, Getform).
2. Put its URL on the form: `<form id="contact-form" data-endpoint="https://formspree.io/f/xxxxxxx" …>`.
3. For Web3Forms, also add `<input type="hidden" name="access_key" value="YOUR_KEY">` inside the form.

Submissions are posted as `FormData` with fields `name`, `email`, `company`, `need` (multiple), `budget` and `message`.

## Live chain widget

- Configured in `CONFIG` at the top of `assets/js/main.js`: RPC endpoints (tried in order), poll interval, and the fallback anchor block.
- Uses one `eth_feeHistory` call per poll and pauses while the tab is hidden.
- For more reliability, add your own endpoint (Alchemy, Infura, QuickNode…). Keys in front-end code are public, so use a domain-restricted key.
- Visitors' browsers talk to the RPC provider directly. To remove the widget entirely, delete `#chain-card` and `.footer__live` from `index.html`.

## Social preview image

`assets/img/og-image.png` is rendered from `tools/og-image.html`. After editing the template:

```bash
python3 -m http.server 8080 &
google-chrome --headless --hide-scrollbars --window-size=1200,630 --virtual-time-budget=4000 \
  --screenshot="$PWD/assets/img/og-image.png" http://localhost:8080/tools/og-image.html
```

## Deploy

All paths are relative, so the site works from any host or sub-path.

- **Vercel / Netlify / Cloudflare Pages**: import the folder or repo. There's no build command, and the output directory is the project root.
- **GitHub Pages**: push to a repository, then *Settings → Pages → Deploy from a branch* (root).
- **IPFS + ENS** (a nice signal for a Web3 engineer): pin the folder with Pinata, Fleek, 4EVERLAND or `ipfs add -r --cid-version=1 .`, set the CID as your name's *content hash* at [app.ens.domains](https://app.ens.domains), and it's live at `<name>.eth.limo`.

After deploying, make sure the canonical URL, `og:url`, `og:image`, `robots.txt` and `sitemap.xml` point at your real domain. Then test the preview with a link-preview debugger (X, LinkedIn or Telegram).

## Project structure

```
index.html                 Markup and all content
assets/css/style.css       Design tokens, components, responsive rules
assets/js/main.js          Interactions (no dependencies, each feature isolated)
assets/fonts/              Self-hosted Geist, Geist Mono, Instrument Serif + licences
assets/img/                Favicon, app icons, social preview image
tools/og-image.html        Template for the social preview image
site.webmanifest           App manifest
robots.txt, sitemap.xml    Search engine hints
```

## Customising the design

- **Colours**: CSS variables at the top of `style.css` (`--mint`, `--sky`, `--violet`, `--grad`, …).
- **Sections**: each is a self-contained `<section>`. Delete what you don't need, and its nav, mobile-menu, footer and command-menu entries (the latter live in `initPalette()` in `main.js`).
- **Motion**: entrance and scroll animations are CSS. The hero network animates continuously on capable devices and pulses once per block on phones. Everything respects `prefers-reduced-motion`.

## Licences

- Fonts: Geist and Geist Mono (© The Geist Project Authors) and Instrument Serif (© The Instrument Serif Project Authors), all under the SIL Open Font License 1.1. See `assets/fonts/OFL-*.txt`.
- Site code: yours to use and adapt for your own portfolio.
