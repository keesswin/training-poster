# Making the poster generator live for the team

The app is a static site (no server, no database), hosted on GitHub Pages or Netlify. Photos and logos never leave the employee's browser.

## Option A: GitHub Pages from the `/docs` folder (simplest)

The built site is committed in `docs/`. After any code change, run `npm run build:pages`, commit `docs/`, and push; Pages republishes in about a minute.

1. **Settings → Pages → Build and deployment → Source: Deploy from a branch.**
2. **Branch:** the repo's default branch (`claude/modest-allen-jfvr5y`), and change the folder from `/ (root)` to **`/docs`**. Click **Save**. (`/ (root)` would publish the unbuilt source and show a blank page.)
3. Wait about a minute, then open **https://keesswin.github.io/training-poster/** (shown at the top of the Pages settings).
4. Do one full test poster: logo shows, add photos, export the PNG, copy the WhatsApp message.
5. Optional custom name: Settings → Pages → Custom domain, e.g. `poster.leadersdesk.org`, plus a DNS `CNAME poster → keesswin.github.io`.

The Pages site is public to anyone with the link, even when the repo is private. (Private Pages visibility needs GitHub Enterprise.)

### Alternative: Source "GitHub Actions"
`.github/workflows/pages.yml` can build and deploy automatically instead. Set Source to **GitHub Actions** and run the workflow from the Actions tab (**Run workflow**). It is manual-only by default; add `push:` triggers back under `on:` for auto-deploys.

## Option B: Netlify (same host as the Leaders Desk hub)

1. Netlify → **Add new site → Import an existing project → GitHub** → `training-poster` → choose the default branch → **Deploy**. Settings come from `netlify.toml`.
2. Open the `https://<site-name>.netlify.app` address and test as above.
3. Optional: Domain management → add `poster.leadersdesk.org` and a DNS `CNAME poster → <site-name>.netlify.app`.

Netlify works with private repos on the free plan.

## Sharing with employees

1. Send the link in the team WhatsApp group or by email, with a two-line how-to: *pick brand → add photos → fill the details → Download PNG or Share on WhatsApp.*
2. Add it to the Leaders Desk hub: **Directory → Add** a tool called "Poster Generator" with the link, so it sits next to CRM and Operations.
3. On phones, open the link and use **Add to Home Screen** so it opens like an app.
4. Tell people that on a phone the **Share poster + message** button opens the share sheet with the poster and caption together. On a laptop it saves the poster and copies the message to attach in WhatsApp Web.

## Good to know

- **Saved items are per browser.** Saved headlines, cities, institutions, audiences and uploaded logos live in that person's browser, so each employee builds their own list. The built-in logos come from the repo and are the same for everyone.
- **Access control.** A Netlify site is public to anyone with the link. If it must be staff-only, use Netlify's password protection (paid plans) or put it behind Cloudflare Access.
- **Changing logos, brand colours or description templates:** edit the file in GitHub (`src/assets/logos/…`, `src/poster/brands.ts`, `src/poster/format.ts`) and merge; Netlify redeploys.
- **Local run and tests:** `npm install`, `npm run dev`, `npm test`, `npm run test:e2e`.
