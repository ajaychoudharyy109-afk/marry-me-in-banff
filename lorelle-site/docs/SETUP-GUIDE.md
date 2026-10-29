# Setup guide — giving Lorelle a login (for AJ)

One-time setup, about 40 minutes. Afterwards Lorelle edits the site herself at
**marrymeinbanff.ca/admin** and never touches code.

## How it works (so the steps make sense)

```
Lorelle edits in /admin  →  "Publish"  →  saved as a change in GitHub  →  Netlify rebuilds  →  live in ~1 minute
```

- The website's words, photo lists and section order now live in two small files (`content/home.json`, `content/settings.json`). `build.js` turns them into the page.
- `/admin` is **Decap CMS**, a free editor that runs in the browser. It signs in with GitHub.
- Two tiny functions in `netlify/functions/` do the GitHub sign-in handshake. They need two secret values from a GitHub "OAuth App" (step 3).
- Your current site (drag-and-drop on Netlify) **keeps running untouched** until step 5, so nothing breaks while you set this up.

You need: a GitHub account (free), your Netlify login, and your Squarespace DNS login.

---

## 1 · Put the project on GitHub

1. Unzip `lorelle-site.zip`.
2. On GitHub: **New repository** → name `marry-me-in-banff` → **Private** → Create.
3. On the empty repo page click **uploading an existing file**, then drag in **everything inside** the unzipped folder (`admin`, `content`, `docs`, `images`, `netlify`, `src`, and the loose files `build.js`, `netlify.toml`, `package.json`, `README.md`). Folders must keep their names. Commit.
   - The browser uploader takes up to 100 files at once; this project is about 50, so one go is fine.
   - Prefer the command line? `git init`, `git add .`, `git commit`, `git remote add origin …`, `git push -u origin main` works too, and the included `.gitignore` is right.
4. Open `admin/config.yml` on GitHub (pencil icon) and change this line to your real username, then commit:

   ```yaml
   repo: YOUR-GITHUB-USERNAME/marry-me-in-banff
   ```

   (The build prints a warning until you do.)

## 2 · Note on branch name

The config expects the branch to be called `main` (GitHub's default for new repos). If yours is `master`, change `branch: main` in `admin/config.yml` to match.

## 3 · Register the GitHub "OAuth App" (the login key)

GitHub → your profile picture → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.

| Field | Value |
|---|---|
| Application name | `Marry Me, In Banff editor` |
| Homepage URL | `https://marrymeinbanff.ca` |
| Authorization callback URL | `https://marrymeinbanff.ca/oauth/callback` ← must be exactly this |

Click **Register application**, then:
- copy the **Client ID**;
- click **Generate a new client secret** and copy it now (GitHub shows it once).

Keep both for step 4. Treat the secret like a password.

## 4 · Create the new Netlify site from GitHub

> A drag-and-drop site can't be linked to Git, so this is a **new** Netlify site. Your old one stays as a backup.

1. Netlify → **Add new site** (newer dashboards say **Add new project**) → **Import an existing project** → **GitHub** → authorise → pick `marry-me-in-banff`. Netlify renames buttons now and then; the idea is always "new site from a Git repository".
2. The build settings fill in automatically from `netlify.toml` (command `node build.js`, publish folder `dist`). Leave them.
3. **Before the first deploy**, add environment variables (the setup screen has an *Add environment variables* option; otherwise Site configuration → Environment variables):

   | Key | Value | Notes |
   |---|---|---|
   | `GITHUB_CLIENT_ID` | the Client ID from step 3 | |
   | `GITHUB_CLIENT_SECRET` | the secret from step 3 | tick **Contains secret values** |

   Optional: `GITHUB_SCOPE` = `public_repo` — only if you made the repository **public** (it asks GitHub for less permission). Default is `repo`, which is what a private repo needs.
4. **Deploy.** The first build takes 1–3 minutes (it installs the editor and the image tool).
5. Open the temporary `https://something.netlify.app` address. **The site should look exactly like the live one.** (I compared the two page-by-page at desktop and phone widths: zero pixel differences.) `/admin` won't log in on this temporary address; that comes after step 5.

   If you added the environment variables *after* a deploy, run **Deploys → Trigger deploy → Clear cache and deploy site** so the login functions see them.

## 5 · Move marrymeinbanff.ca to the new site

A domain can belong to only one Netlify site, so move it in this order. Expect a few minutes of the HTTPS padlock being unsettled; do it at a quiet hour.

1. **Old site** (spectacular-manatee-a2a682) → Domain management → remove `marrymeinbanff.ca` (and `www`).
2. **New site** → Domain management → **Add a domain** → `marrymeinbanff.ca` → set it as the **primary** domain (so `www` redirects to it).
3. **Squarespace DNS:**
   - `@` A record → `75.2.60.5` — already correct, leave it.
   - `www` CNAME → change to the **new** site's name, e.g. `new-name-123abc.netlify.app` (find it at the top of the new site's page).
   - Leave the Google Workspace MX records alone — Lorelle's email depends on them.
4. New site → Domain management → HTTPS → **Verify DNS configuration**, then **Provision certificate** if it hasn't done so itself.
5. Check `https://marrymeinbanff.ca` and `https://www.marrymeinbanff.ca` both load the site.

## 6 · Test the login yourself first

1. Go to `https://marrymeinbanff.ca/admin/` → **Login with GitHub** → authorise.
2. Open **Website → Home page**. You should see the page's sections as a list.
3. Make a harmless edit (e.g. add a word to a FAQ answer) → **Publish → Publish now**.
4. Check: a new commit appears on GitHub; a deploy starts on Netlify; ~1 minute later the change is live. Then undo your edit the same way.

If `/admin` shows a configuration error, it names the offending field. Send it to me and I'll fix it.

While you're in there, skim `docs/LORELLE-QUICKSTART.md` against what you actually see (button names like *Add section*, *Add photo*, *Publish → Publish now*, and how drag-to-reorder looks). I wrote it from Decap's documentation and could not open the editor from where I built this, so adjust any wording that differs before you send it to her.

## 7 · Let Lorelle in

1. Lorelle makes a free account at github.com/signup (her own email; ask her to switch on two-factor sign-in).
2. Your repo → **Settings → Collaborators → Add people** → her username → role **Write**. She accepts the email invite.
3. She opens `marrymeinbanff.ca/admin`, clicks **Login with GitHub**, and presses **Authorize** the first time.
4. Send her **`docs/LORELLE-QUICKSTART.md`**.

---

## Good to know

**What she can change:** every word, every photo, the order of sections (drag), adding or removing sections, the gallery photos, packages and prices, FAQ, the menu labels, footer, Instagram link, email, and the site colours. The three structural things she can't break: the design itself, the animations, and the login (all in code).

**There is no draft/preview step.** *Publish* goes live in about a minute. That's deliberate (it keeps the editor simple). If something looks wrong she tells you, and it can always be undone.

**Undo / roll back.** Netlify → Deploys → pick an earlier deploy → **Publish deploy** (instant). Or on GitHub open the commit and **Revert**. Nothing is ever lost.

**If a publish doesn't change the site,** open Netlify → Deploys. A failed build (for example a typo that makes the data invalid) leaves the previous version live and the log says why.

**Photos.** She can upload JPG or PNG straight from her phone. The build shrinks anything over 1800 px, straightens sideways phone photos and removes hidden camera data (including GPS location) from the *published* copy. The original upload stays in the repo, which is private. HEIC files don't display in browsers: iPhones normally convert to JPG when uploading from the web, but if one is ever rejected, "Most Compatible" in the camera settings avoids it.

**Cost.** GitHub free, Netlify free plan. Each publish uses one Netlify build; check Netlify's current free allowance if she's likely to publish dozens of times a month.

**The login scope.** GitHub's sign-in asks for `repo` permission, which is the standard way for any GitHub-based editor to write to a private repository. Her token can only touch repositories her GitHub account can reach: just this one, unless she has others. The secret never reaches the browser (the callback function swaps the code for the token on the server, checks a one-time `state` value, and only hands the token to the site's own address).

## Troubleshooting

| What you see | Likely cause / fix |
|---|---|
| Pop-up opens then closes, nothing happens | Callback URL in the OAuth App isn't exactly `https://marrymeinbanff.ca/oauth/callback`, or the env vars were added after the deploy (redeploy with *Clear cache*). Also check the browser isn't blocking pop-ups. |
| "The login service is not set up yet" in the pop-up | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` missing or misspelled in Netlify. |
| "Failed to load config.yml" | Typo in `admin/config.yml` (indentation matters), or `repo:` still says `YOUR-GITHUB-USERNAME`. |
| Logs in, then "Not Found" / "no access" | `repo:` is wrong, or Lorelle hasn't accepted the collaborator invite. |
| Logged in on `*.netlify.app` but it fails | Use the real domain: the login is tied to `marrymeinbanff.ca`. |
| Publish worked on GitHub but the site didn't change | Netlify → Deploys → read the failed deploy's log. |
| A photo is missing on the page | The build log lists it ("…is not in the images folder"). Re-upload it in the editor. |
| `www` shows a certificate warning | `www` CNAME still points at the old site name; update it (step 5.3). |

## Changing the design later

- Look, colours, spacing, animation → `src/styles.css`. Behaviour → `src/script.js`.
- New kind of content block → three places: add a renderer in `build.js` (`R.my_block = …`), add the type in `admin/config.yml`, and use it in `content/home.json`. `README.md` has the details.
- Test locally: `npm install`, then `npm run preview` (needs Node 20+). To try the editor without GitHub, run `npm run cms` in a second terminal and open `http://localhost:8080/admin/`.
