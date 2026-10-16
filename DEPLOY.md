# Making the poster generator live for the team

The app is a static site (no server, no database), hosted on GitHub Pages or Netlify. Photos and logos never leave the employee's browser.

## Option A: GitHub Pages (workflow already in the repo)

`.github/workflows/pages.yml` tests, builds and publishes the site every time you push. The repo's default branch is currently `claude/modest-allen-jfvr5y` (there is no `main`, and none is needed). The workflow runs on that branch and on `main` if you ever create one.

1. **Check your plan.** GitHub Pages works for a **public** repo on any plan. For a **private** repo (this one is private) you need GitHub Pro, Team or Enterprise. If you are on Free, either make the repo public (the logos and code become visible to everyone) or use Option B.
2. **Turn Pages on.** Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Run the workflow.** Repo → **Actions → Deploy to GitHub Pages → Run workflow** (or just push a commit). It takes about a minute.
4. **If the deploy is refused** with a branch-protection message: **Settings → Environments → github-pages → Deployment branches**, and allow the default branch.
5. **Open the address** GitHub shows on the Pages settings page: `https://keesswin.github.io/training-poster/`. Do a full test poster: logo shows, add photos, export the PNG, copy the WhatsApp message.
6. **Optional custom name:** Settings → Pages → Custom domain, e.g. `poster.leadersdesk.org`, plus a DNS `CNAME poster → keesswin.github.io`.

Every later push to the default branch redeploys automatically.

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
