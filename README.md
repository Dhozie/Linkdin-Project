# My LinkedIn Journey — LinkedIn Content Planner

My LinkedIn Journey is a personal, static LinkedIn planning and posting journal built with HTML, CSS and vanilla JavaScript. It needs no server or build step.

## Run locally

Open `index.html` in a modern browser. If your browser restricts local files, use any static file server (for example, VS Code Live Server); there is no backend. Keep the `Font` and `assets` folders alongside `index.html`.

## Data and backups

Posts, ideas, preferences and schedule days are stored in this browser's LocalStorage. They persist after refresh, but do not sync across browsers or devices. Use Settings → Export JSON to download a backup. Import validates the JSON structure and asks before replacing current data. Keep backup files somewhere safe.

## GitHub

From this directory, create an empty GitHub repository, then run:

```sh
git init
git add .
git commit -m "Build LinkedIn content planner"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

If the project is already a Git repository, skip `git init`; inspect `git status` and the existing remote first.

## Netlify

Push the project to GitHub, then in Netlify choose **Add new site → Import an existing project**, select the repository, leave the build command empty, and set the publish directory to `.` (the repository root). Deploy. The site is static; no redirect or server configuration is required.

## Features

- Overview, schedule, planner, ideas bank, post history, insights and settings.
- Three-post weekly target, Monday/Wednesday/Friday defaults, Africa/Lagos week calculations and streak tracking.
- Status transitions, post and idea editing, deletion confirmation, filters and search.
- JSON backup and restore, with data clear confirmation.
- Responsive desktop and mobile layouts.

Atma font files are provided locally in `Font/Atma`. Manrope is loaded from Google Fonts, with a system sans-serif fallback if unavailable.
