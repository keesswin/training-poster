# Making the poster generator live for the team

The app is a static site (no server, no database), hosted on Netlify like the Leaders Desk hub. Photos and logos never leave the employee's browser.

## One-time setup (about 10 minutes)

1. **Merge the code into `main`.** On GitHub, open a pull request from `claude/modest-allen-jfvr5y` into `main` in `keesswin/training-poster` and merge it. (Or skip this and pick that branch in step 3.)
2. **Check the logos are in the repo:** `src/assets/logos/leaders-desk.png` and `src/assets/logos/leaders-foundation.png`. They are the default logo for each brand.
3. **Create the site on Netlify.** Sign in at netlify.com → **Add new site → Import an existing project → GitHub** → choose `training-poster` and the production branch (`main`). Netlify reads `netlify.toml` (build `npm run build`, publish `dist`), so leave the fields as filled in and click **Deploy**.
4. **Open the generated address** (`https://<site-name>.netlify.app`) and do a test poster end to end: logo shows, add photos, export the PNG, copy the WhatsApp message.
5. **Give it a proper name** (recommended). Netlify → **Site configuration → Domain management → Add a domain**, e.g. `poster.leadersdesk.org`, then at your DNS provider add `CNAME  poster  →  <site-name>.netlify.app`. HTTPS is issued automatically.

From then on, every push to `main` redeploys automatically in about a minute.

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
