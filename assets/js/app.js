(() => {
  "use strict";

  // START: Application configuration
  const KEY = "linkedinJournal.v1";
  const CATS = [
    "What I'm Learning",
    "Projects I'm Building",
    "Technical Knowledge and Tutorials",
    "Personal Experiences and Lessons",
    "Career Development and Professional Insights",
  ];
  const DAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const DEFAULT = {
    version: 1,
    posts: [],
    ideas: [],
    settings: {
      target: 3,
      days: [1, 3, 5],
      timezone: "Africa/Lagos",
      preferredName: "",
    },
    preferences: {},
  };
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // END: Application configuration

  // START: LocalStorage management and application data
  // LocalStorage keeps data in this browser; defaults fill in fields missing from older saves.
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULT);
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.posts) || !Array.isArray(d.ideas))
        throw Error("Invalid saved data");
      return {
        ...structuredClone(DEFAULT),
        ...d,
        settings: { ...DEFAULT.settings, ...d.settings },
      };
    } catch (e) {
      console.error(e);
      return structuredClone(DEFAULT);
    }
  }

  // Load saved journal data once when the application starts.
  let db = load(),
    weekOffset = 0,
    toastTimer;

  // Save the complete data object under the existing key to keep old data compatible.
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      toast("Could not save data. Browser storage may be full or unavailable.");
      return false;
    }
  }

  // END: LocalStorage management and application data

  // START: Date and week calculations
  function uid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // Use Africa/Lagos for "today" so dates match the journal's configured timezone.
  function lagosToday() {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const o = {};
    p.forEach((x) => (o[x.type] = x.value));
    return `${o.year}-${o.month}-${o.day}`;
  }
  // UTC midday keeps saved calendar dates stable when formatting across timezones.
  function dateObj(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
  }
  function isoDate(d) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  function shiftDay(s, n) {
    const d = dateObj(s);
    d.setUTCDate(d.getUTCDate() + n);
    return isoDate(d);
  }
  function monday(s) {
    const d = dateObj(s),
      dow = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
    return isoDate(d);
  }
  function weekStart(offset = 0) {
    return shiftDay(monday(lagosToday()), offset * 7);
  }
  function fmt(s, opt = { month: "short", day: "numeric" }) {
    return new Intl.DateTimeFormat("en-GB", { ...opt, timeZone: "UTC" }).format(
      dateObj(s),
    );
  }
  function nowISO() {
    return new Date().toISOString();
  }

  // Count only Published posts whose publish date falls inside the Monday-to-Sunday week.
  function weekPosts(start) {
    const end = shiftDay(start, 6);
    return db.posts.filter(
      (p) =>
        p.status === "Published" &&
        (p.publishedOn || p.date) >= start &&
        (p.publishedOn || p.date) <= end,
    );
  }
  function streak() {
    let cur = monday(lagosToday()),
      count = 0;
    // A streak counts consecutive Monday-to-Sunday weeks that meet the weekly target.
    if (weekPosts(cur).length >= db.settings.target) count++;
    cur = shiftDay(cur, -7);
    while (weekPosts(cur).length >= db.settings.target) {
      count++;
      cur = shiftDay(cur, -7);
    }
    return count;
  }

  // Show the Published posts for a week as a percentage of the configured target.
  function pct(n) {
    return Math.min(
      100,
      Math.round((n / Math.max(1, db.settings.target)) * 100),
    );
  }

  // END: Date and week calculations

  // START: Shared rendering and interface helpers
  function esc(s = "") {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }
  function toast(s) {
    const t = $("#toast");
    t.textContent = s;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }
  function go(view) {
    $$("[data-view]").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === view),
    );
    $("#app").innerHTML = views[view]();
    $("#app").dataset.view = view;
    bindView(view);
    history.replaceState(null, "", "#" + view);
    $(".nav.left").classList.remove("open");
    $(".nav.right").classList.remove("open");
    $("#menuBtn").setAttribute("aria-expanded", "false");
    $("#menuBtn").setAttribute("aria-label", "Open navigation");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function shell(eyebrow, title, sub, button = "", introClass = "") {
    return `<div class="hero"><div><p class="eyebrow ${introClass}">${eyebrow}</p><h1>${title}</h1><p class="sub">${sub}</p></div>${button}</div>`;
  }
  function empty(title, detail, action = "") {
    return `<div class="empty"><b>${title}</b>${detail}${action ? `<div style="margin-top:15px">${action}</div>` : ""}</div>`;
  }
  function postMini(p) {
    return `<div class="post-row"><div class="date-tile"><b>${fmt(p.date, { day: "2-digit" })}</b><small>${fmt(p.date, { month: "short" })}</small></div><div class="post-info"><b>${esc(p.title)}</b><small>${esc(p.category)} · ${DAY_NAMES[dateObj(p.date).getUTCDay()]}</small></div><span class="badge ${p.status}">${p.status}</span></div>`;
  }
  function postCard(p) {
    return `<article class="card post-card"><div class="post-row" style="padding:0;border:0"><div class="post-info"><div class="meta">${fmt(p.status === "Published" ? p.publishedOn || p.date : p.date, { year: "numeric", month: "short", day: "numeric" })} · ${esc(p.category)} <span class="badge ${p.status}">${p.status}</span></div><h3>${esc(p.title)}</h3></div><div class="actions"><button class="button small" data-edit-post="${p.id}">Edit</button><button class="button small" data-status-post="${p.id}">${p.status === "Planned" ? "Mark ready" : p.status === "Ready" ? "Mark published" : "Mark ready"}</button><button class="button small danger" data-delete-post="${p.id}">Delete</button></div></div>${p.content ? `<p>${esc(p.content)}</p>` : '<p class="muted">No draft text yet.</p>'}${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">View on LinkedIn ↗</a>` : ""}<small class="muted">Created ${fmt(p.created.slice(0, 10), { year: "numeric", month: "short", day: "numeric" })}${p.updated ? ` · Updated ${fmt(p.updated.slice(0, 10), { year: "numeric", month: "short", day: "numeric" })}` : ""}</small></article>`;
  }

  // END: Shared rendering and interface helpers

  // START: Overview dashboard
  function overview() {
    const start = monday(lagosToday()),
      pub = weekPosts(start),
      remaining = Math.max(0, db.settings.target - pub.length),
      soon = db.posts
        .filter((p) => p.status !== "Published" && p.date >= lagosToday())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 4),
      recent = db.posts
        .filter((p) => p.status === "Published")
        .sort((a, b) => b.updated.localeCompare(a.updated))
        .slice(0, 4),
      day = dateObj(lagosToday()).getUTCDay();
    let rem = "";
    if (day === 1 && pub.length === 0)
      rem = "Time to publish your first LinkedIn post of the week.";
    else if (day === 2 && pub.length < 2)
      rem = "Have you prepared your Wednesday post?";
    else if (day === 3 && pub.length < 2)
      rem = "Your second publishing day is here.";
    else if (day === 4 && pub.length < 3) rem = "Get your Friday post ready.";
    else if (day === 5 && pub.length < 3)
      rem = "Your final publishing day of the week. Finish strong.";
    else
      rem =
        remaining === 0
          ? "Your weekly target is complete. Take a moment to celebrate."
          : `${remaining} ${remaining === 1 ? "post remains" : "posts remain"} in this week's target.`;
    const preferredName = (
      db.settings.preferredName ||
      db.preferences.name ||
      ""
    ).trim();
    return (
      shell(
        preferredName
          ? `Hi, I'm ${esc(preferredName)} 👋`
          : "YOUR PERSONAL POSTING JOURNAL",
        "Welcome back to My LinkedIn Journey.",
        `A thoughtful rhythm for what you want to share. · Week of ${fmt(start, { month: "long", day: "numeric" })}`,
        `<button class="button dark" data-new-post>＋ Plan a post</button>`,
        "dashboard-greeting",
      ) +
      `<div class="grid stats"><div class="card stat"><span class="label">Weekly target</span><strong>${db.settings.target}</strong><small>posts every week</small></div><div class="card stat"><span class="label">Published this week</span><strong>${pub.length}</strong><small>explicitly marked published</small></div><div class="card stat"><span class="label">Still to go</span><strong>${remaining}</strong><small>to reach this week's target</small></div><div class="card stat"><span class="label">Current streak</span><strong>${streak()} <small style="font:12px Manrope">${streak() === 1 ? "week" : "weeks"}</small></strong><small>consecutive complete weeks</small></div></div><div class="grid two-col"><section class="card"><div class="section-head"><div><p class="eyebrow">THIS WEEK</p><h2>Keeping your rhythm</h2></div><span>${pct(pub.length)}%</span></div><div class="progress-wrap"><div class="progress-ring" style="--p:${pct(pub.length)}%"><span>${pub.length}/${db.settings.target}</span></div><div class="progress-copy"><h3>${pub.length >= db.settings.target ? "Target complete" : `${remaining} ${remaining === 1 ? "post" : "posts"} to go`}</h3><p>${fmt(start, { month: "short", day: "numeric" })} – ${fmt(shiftDay(start, 6), { month: "short", day: "numeric" })}. Only published posts count toward this week's progress.</p></div></div><div class="reminder"><p>${esc(rem)}</p><small>Today · ${fmt(lagosToday(), { weekday: "long", month: "long", day: "numeric" })}</small></div></section><section class="card"><div class="section-head"><div><p class="eyebrow">UP NEXT</p><h2>Your schedule</h2></div><button class="text-btn" data-go="schedule">View week</button></div>${soon.length ? `<div class="post-list">${soon.map(postMini).join("")}</div>` : empty("Nothing scheduled yet", "Plan a post and it will appear here.", `<button class="button small" data-new-post>Plan a post</button>`)}</section><section class="card"><div class="section-head"><div><p class="eyebrow">RECENTLY PUBLISHED</p><h2>Your journal</h2></div><button class="text-btn" data-go="history">See history</button></div>${recent.length ? `<div class="post-list">${recent.map(postMini).join("")}</div>` : empty("Your story starts here", "Published posts will appear here after you mark them Published.")}</section><section class="card"><p class="eyebrow">A NOTE TO YOURSELF</p><h2 style="font-size:27px">Consistency over perfection.</h2><p class="sub">A small, steady cadence gives your ideas room to reach people. Keep it personal, keep it yours.</p><p class="footer-note">Your journal is stored in this browser. Export a backup in Settings.</p></section></div>`
    );
  }

  // END: Overview dashboard

  // START: Weekly schedule
  function schedule() {
    const s = weekStart(weekOffset),
      days = Array.from({ length: 7 }, (_, i) => shiftDay(s, i));
    return (
      shell(
        "YOUR WEEK AT A GLANCE",
        "My Schedule",
        "A clear view of the posts you plan to share.",
        `<div class="weekbar"><button class="button small" data-week="-1" aria-label="Previous week">←</button><strong>${fmt(s, { month: "short", day: "numeric" })} – ${fmt(shiftDay(s, 6), { month: "short", day: "numeric", year: "numeric" })}</strong><button class="button small" data-week="1" aria-label="Next week">→</button><button class="button small" data-week="0">Today</button></div>`,
      ) +
      `<div class="grid week-grid">${days
        .map((d) => {
          const dt = dateObj(d),
            posts = db.posts
              .filter((p) => p.date === d)
              .sort((a, b) => a.created.localeCompare(b.created));
          return `<article class="card day-card ${d === lagosToday() ? "today" : ""}"><p class="eyebrow">${DAY_NAMES[dt.getUTCDay()]}</p><h3>${fmt(d, { month: "long", day: "numeric" })}</h3><span class="day-date">${db.settings.days.includes(dt.getUTCDay()) ? "Publishing day" : "Open day"}</span><div class="slot">${posts.length ? posts.map((p) => `<div><span class="badge ${p.status}">${p.status}</span><p><b>${esc(p.title)}</b></p><button class="text-btn" data-edit-post="${p.id}">Open post</button></div>`).join("") : db.settings.days.includes(dt.getUTCDay()) ? '<p class="muted">No post planned yet.</p>' : '<p class="muted">A little breathing room.</p>'}</div>${db.settings.days.includes(dt.getUTCDay()) ? `<button class="text-btn" data-new-date="${d}">＋ Add a post</button>` : ""}</article>`;
        })
        .join("")}</div>`
    );
  }

  // END: Weekly schedule

  // START: Content planner
  function planner() {
    let posts = [...db.posts].sort((a, b) => a.date.localeCompare(b.date));
    return (
      shell(
        "SHAPE YOUR NEXT IDEA",
        "Content Planner",
        "Draft, prepare and keep track of what you want to publish.",
        `<button class="button dark" data-new-post>＋ Create a post</button>`,
      ) +
      `<div class="toolbar"><input id="postSearch" placeholder="Search titles and drafts…"><select id="postStatus"><option value="">All statuses</option><option>Planned</option><option>Ready</option><option>Published</option></select><select id="postCategory"><option value="">All categories</option>${CATS.map((c) => `<option>${esc(c)}</option>`).join("")}</select><input id="postDate" type="month" aria-label="Filter by month"></div><div id="postResults">${posts.length ? posts.map(postCard).join("") : empty("A blank page, full of possibility.", "Create your first post to begin planning your weekly rhythm.", `<button class="button" data-new-post>Plan your first post</button>`)}</div>`
    );
  }

  // END: Content planner

  // START: Ideas bank
  function ideasView() {
    return (
      shell(
        "A NOTEBOOK FOR WHAT'S NEXT",
        "Ideas Bank",
        "Catch an idea while it is still fresh. You can shape it into a post whenever you are ready.",
        `<button class="button dark" data-new-idea>＋ Save an idea</button>`,
      ) +
      `<div class="toolbar"><input id="ideaSearch" placeholder="Search ideas and notes…"></div><div id="ideaResults" class="grid ideas-grid">${ideasCards(db.ideas)}</div>`
    );
  }
  function ideasCards(items) {
    return items.length
      ? items
          .slice()
          .sort((a, b) => b.created.localeCompare(a.created))
          .map(
            (i) =>
              `<article class="card idea-card"><p class="eyebrow">${esc(i.category)}</p><h3>${esc(i.title)}</h3><p>${esc(i.description || "A thought waiting to be explored.")}</p><div class="idea-foot"><small class="muted">Added ${fmt(i.created.slice(0, 10), { month: "short", day: "numeric" })}</small><div><button class="text-btn" data-convert="${i.id}">Make a post</button> <button class="text-btn" data-edit-idea="${i.id}">Edit</button> <button class="text-btn danger" data-delete-idea="${i.id}">Delete</button></div></div></article>`,
          )
          .join("")
      : empty(
          "The notebook is open.",
          "Collect the questions, lessons and projects you may want to share.",
          `<button class="button" data-new-idea>Save your first idea</button>`,
        );
  }

  // END: Ideas bank

  // START: Post history
  function historyView() {
    const p = db.posts
      .filter((x) => x.status === "Published")
      .sort((a, b) =>
        (b.publishedOn || b.date).localeCompare(a.publishedOn || a.date),
      );
    return (
      shell(
        "THE WORK YOU HAVE SHARED",
        "Post History",
        "A chronological record of posts you have explicitly marked Published.",
      ) +
      `<div class="toolbar"><input id="historySearch" placeholder="Search published posts…"><select id="historyCategory"><option value="">All categories</option>${CATS.map((c) => `<option>${esc(c)}</option>`).join("")}</select><input id="historyMonth" type="month" aria-label="Filter by month"></div><div id="historyResults">${p.length ? p.map(postCard).join("") : empty("No published posts yet.", "When you mark a post Published, it will be recorded here.")}</div>`
    );
  }

  // END: Post history

  // START: Insights
  function insights() {
    const published = db.posts.filter((p) => p.status === "Published"),
      start = monday(lagosToday()),
      thisweek = weekPosts(start),
      allWeeks = new Map();
    published.forEach((p) => {
      const w = monday(p.publishedOn || p.date);
      allWeeks.set(w, (allWeeks.get(w) || 0) + 1);
    });
    const active = [...allWeeks.keys()]
      .filter((w) => allWeeks.get(w) >= db.settings.target)
      .sort();
    let best = 0,
      run = 0,
      last = null;
    active.forEach((w) => {
      if (last && shiftDay(last, 7) === w) run++;
      else run = 1;
      best = Math.max(best, run);
      last = w;
    });
    let weeks = [];
    for (let i = 7; i >= 0; i--) {
      const w = shiftDay(start, -7 * i);
      weeks.push({ w, n: weekPosts(w).length });
    }
    const counts = CATS.map((c) => [
      c,
      published.filter((p) => p.category === c).length,
    ]);
    return (
      shell(
        "YOUR PRACTICE IN PERSPECTIVE",
        "Insights",
        "A few grounded signals from the work you have logged.",
      ) +
      `<div class="grid stats"><div class="card stat"><span class="label">Published total</span><strong>${published.length}</strong><small>in your journal</small></div><div class="card stat"><span class="label">This week</span><strong>${thisweek.length}</strong><small>of ${db.settings.target} planned</small></div><div class="card stat"><span class="label">Weekly completion</span><strong>${pct(thisweek.length)}%</strong><small>current week</small></div><div class="card stat"><span class="label">Current streak</span><strong>${streak()}</strong><small>complete weeks</small></div></div><div class="grid two-col"><section class="card"><p class="eyebrow">PUBLISHING ACTIVITY</p><h2>Recent weeks</h2><div class="chart">${weeks.map((x) => `<div class="bar-wrap"><span>${x.n || ""}</span><div class="bar" style="height:${Math.max(3, Math.min(100, (x.n / db.settings.target) * 100))}%"></div><small>${fmt(x.w, { month: "short", day: "numeric" })}</small></div>`).join("")}</div><p class="footer-note">Best recorded consistency: ${best} ${best === 1 ? "consecutive week" : "consecutive weeks"} with publishing activity. A completed week means ${db.settings.target} published posts.</p></section><section class="card"><p class="eyebrow">WHAT YOU WRITE ABOUT</p><h2>Category mix</h2>${counts.map(([c, n]) => `<div class="category-line"><span>${esc(c)}</span><b>${n}</b><i><b style="width:${published.length ? Math.round((n / published.length) * 100) : 0}%"></b></i></div>`).join("")}${!published.length ? '<p class="footer-note">Category insights will appear as you publish posts.</p>' : ""}</section></div>`
    );
  }

  // END: Insights

  // START: Settings and preferred name
  function settings() {
    return (
      shell(
        "MAKE THIS JOURNAL YOURS",
        "Settings",
        "Your information stays in this browser unless you export a backup.",
      ) +
      `<div class="grid settings-grid"><section class="card settings-card"><p class="eyebrow">PUBLISHING RHYTHM</p><h2>Weekly plan</h2><label>Weekly target <input value="3 posts per week" disabled><small class="muted">The completion and streak rules are based on three posts each week.</small></label><span style="font-size:10px;font-weight:800">Publishing days <small class="muted">(choose exactly three)</small></span><div class="checkdays">${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => `<label><input type="checkbox" data-day="${i}" ${db.settings.days.includes(i) ? "checked" : ""}>${d}</label>`).join("")}</div><label>Timezone<input value="Africa/Lagos" disabled></label><label>Preferred Name<input id="prefName" maxlength="50" value="${esc(db.settings.preferredName || db.preferences.name || "")}" placeholder="Optional"></label><button class="button dark" id="saveSettings">Save preferences</button></section><section class="card settings-card"><p class="eyebrow">BACKUPS</p><h2>Keep a copy</h2><p class="sub">Your posts and ideas live in this browser's LocalStorage. Export a JSON backup so you can move or restore your journal.</p><div class="settings-actions"><button class="button dark" id="exportData">Export JSON</button><button class="button" id="importData">Import backup</button></div><p class="footer-note">Backups include posts, ideas, settings and preferences. LocalStorage does not sync across devices.</p></section><section class="card settings-card"><p class="eyebrow">START FRESH</p><h2>Clear application data</h2><p class="sub">This removes all posts, ideas and preferences from this browser. Export first if you may want to keep a copy.</p><div class="settings-actions"><button class="button danger" id="clearData">Clear all data</button></div></section></div>`
    );
  }

  // The view map connects each navigation value to its matching renderer.
  const views = {
    overview,
    schedule,
    planner,
    ideas: ideasView,
    history: historyView,
    insights,
    settings,
  };

  // END: Settings and preferred name

  // START: Dialogs, event listeners, and feature actions
  function fillCategories(sel) {
    sel.innerHTML = CATS.map((c) => `<option>${esc(c)}</option>`).join("");
  }
  function openPost(p = {}, date = "") {
    const f = $("#postForm");
    f.reset();
    fillCategories(f.elements.category);
    f.elements.id.value = p.id || "";
    f.elements.title.value = p.title || "";
    f.elements.category.value = p.category || CATS[0];
    f.elements.content.value = p.content || "";
    f.elements.date.value = p.date || date || lagosToday();
    f.elements.status.value = p.status || "Planned";
    f.elements.url.value = p.url || "";
    $("#postDialogTitle").textContent = p.id ? "Edit post" : "New post";
    $("#formError").textContent = "";
    $("#postDialog").showModal();
  }
  function openIdea(i = {}) {
    const f = $("#ideaForm");
    f.reset();
    fillCategories(f.elements.category);
    f.elements.id.value = i.id || "";
    f.elements.title.value = i.title || "";
    f.elements.description.value = i.description || "";
    f.elements.category.value = i.category || CATS[0];
    $("#ideaDialogTitle").textContent = i.id ? "Edit idea" : "New idea";
    $("#ideaDialog").showModal();
  }
  function bindView(view) {
    $("#app").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.matches("[data-new-post]")) openPost();
      if (b.matches("[data-new-date]")) openPost({}, b.dataset.newDate);
      if (b.matches("[data-edit-post]"))
        openPost(db.posts.find((p) => p.id === b.dataset.editPost));
      if (b.matches("[data-delete-post]")) deletePost(b.dataset.deletePost);
      if (b.matches("[data-status-post]")) toggleStatus(b.dataset.statusPost);
      if (b.matches("[data-go]")) go(b.dataset.go);
      if (b.matches("[data-week]")) {
        weekOffset =
          Number(b.dataset.week) === 0
            ? 0
            : weekOffset + Number(b.dataset.week);
        go("schedule");
      }
      if (b.matches("[data-new-idea]")) openIdea();
      if (b.matches("[data-edit-idea]"))
        openIdea(db.ideas.find((i) => i.id === b.dataset.editIdea));
      if (b.matches("[data-delete-idea]")) deleteIdea(b.dataset.deleteIdea);
      if (b.matches("[data-convert]")) {
        const i = db.ideas.find((x) => x.id === b.dataset.convert);
        openPost({
          title: i.title,
          content: i.description,
          category: i.category,
        });
      }
    };
    if (view === "planner") {
      ["postSearch", "postStatus", "postCategory", "postDate"].forEach((id) =>
        $("#" + id).addEventListener("input", filterPosts),
      );
    }
    if (view === "ideas")
      $("#ideaSearch").addEventListener("input", () => {
        $("#ideaResults").innerHTML = ideasCards(
          db.ideas.filter((i) =>
            (i.title + " " + i.description + " " + i.category)
              .toLowerCase()
              .includes($("#ideaSearch").value.toLowerCase()),
          ),
        );
      });
    if (view === "history")
      ["historySearch", "historyCategory", "historyMonth"].forEach((id) =>
        $("#" + id).addEventListener("input", filterHistory),
      );
    if (view === "settings") bindSettings();
  }
  function filterPosts() {
    const q = $("#postSearch").value.toLowerCase(),
      s = $("#postStatus").value,
      c = $("#postCategory").value,
      m = $("#postDate").value;
    const a = db.posts
      .filter(
        (p) =>
          (!q || (p.title + " " + p.content).toLowerCase().includes(q)) &&
          (!s || p.status === s) &&
          (!c || p.category === c) &&
          (!m || p.date.startsWith(m)),
      )
      .sort((x, y) => x.date.localeCompare(y.date));
    $("#postResults").innerHTML = a.length
      ? a.map(postCard).join("")
      : empty(
          "No matching posts.",
          "Adjust your filters or create a new post.",
        );
  }
  function filterHistory() {
    const q = $("#historySearch").value.toLowerCase(),
      c = $("#historyCategory").value,
      m = $("#historyMonth").value;
    const a = db.posts
      .filter(
        (p) =>
          p.status === "Published" &&
          (!q || (p.title + " " + p.content).toLowerCase().includes(q)) &&
          (!c || p.category === c) &&
          (!m || (p.publishedOn || p.date).startsWith(m)),
      )
      .sort((x, y) =>
        (y.publishedOn || y.date).localeCompare(x.publishedOn || x.date),
      );
    $("#historyResults").innerHTML = a.length
      ? a.map(postCard).join("")
      : empty(
          "No matching published posts.",
          "Try a different search or filter.",
        );
  }
  function deletePost(id) {
    if (!confirm("Delete this post permanently?")) return;
    db.posts = db.posts.filter((p) => p.id !== id);
    if (!save()) return;
    toast("Post deleted.");
    go($("#app").dataset.view);
  }
  function deleteIdea(id) {
    if (!confirm("Delete this idea permanently?")) return;
    db.ideas = db.ideas.filter((i) => i.id !== id);
    if (!save()) return;
    toast("Idea deleted.");
    go("ideas");
  }
  function toggleStatus(id) {
    const p = db.posts.find((x) => x.id === id);
    if (!p) return;
    // Posts move Planned -> Ready -> Published; marking Published records its Lagos date.
    if (p.status === "Planned") p.status = "Ready";
    else if (p.status === "Ready") {
      p.status = "Published";
      p.updated = nowISO();
    } else p.status = "Ready";
    if (p.status === "Published") {
      p.publishedAt = p.publishedAt || nowISO();
      p.publishedOn = p.publishedOn || lagosToday();
    } else {
      delete p.publishedAt;
      delete p.publishedOn;
    }
    p.updated = nowISO();
    if (!save()) return;
    toast(`Post marked ${p.status.toLowerCase()}.`);
    go($("#app").dataset.view);
  }
  function bindSettings() {
    $("#saveSettings").onclick = () => {
      const days = $$("[data-day]:checked").map((x) => Number(x.dataset.day));
      if (days.length !== 3) {
        toast("Choose exactly three publishing days.");
        return;
      }
      // Exactly three selected days are required for the weekly publishing schedule.
      db.settings.days = days;
      // Keep the preferred name in settings; the dashboard uses it in its greeting.
      db.settings.preferredName = $("#prefName").value.trim();
      delete db.preferences.name;
      if (!save()) return;
      toast("Preferences saved.");
      go("settings");
    };
    $("#exportData").onclick = exportJSON;
    $("#importData").onclick = () => $("#importFile").click();
    $("#clearData").onclick = () => {
      if (
        !confirm(
          "Clear every post, idea and preference from this browser? This cannot be undone.",
        )
      )
        return;
      localStorage.removeItem(KEY);
      db = structuredClone(DEFAULT);
      toast("Journal data cleared.");
      go("overview");
    };
  }

  // END: Dialogs, event listeners, and feature actions

  // START: Post and idea form submissions
  $("#postForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      d = new FormData(f),
      date = d.get("date"),
      dow = dateObj(date).getUTCDay(),
      url = d.get("url").trim();
    if (!date || date < "1000-01-01") {
      $("#formError").textContent = "Choose a valid scheduled date.";
      return;
    }
    if (!db.settings.days.includes(dow)) {
      $("#formError").textContent =
        `Choose one of your publishing days: ${db.settings.days.map((x) => DAY_NAMES[x]).join(", ")}.`;
      return;
    }
    const id = d.get("id"),
      old = db.posts.find((p) => p.id === id),
      p = {
        id: id || uid(),
        title: d.get("title").trim(),
        category: d.get("category"),
        content: d.get("content").trim(),
        date,
        status: d.get("status"),
        url,
        created: old?.created || nowISO(),
        updated: nowISO(),
      };
    if (p.status === "Published") p.publishedAt = old?.publishedAt || nowISO();
    if (old) db.posts = db.posts.map((x) => (x.id === id ? p : x));
    else db.posts.push(p);
    if (!save()) return;
    $("#postDialog").close();
    toast(old ? "Post updated." : "Post saved.");
    go($("#app").dataset.view || "overview");
  });
  $("#ideaForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget),
      id = d.get("id"),
      old = db.ideas.find((i) => i.id === id),
      i = {
        id: id || uid(),
        title: d.get("title").trim(),
        description: d.get("description").trim(),
        category: d.get("category"),
        created: old?.created || nowISO(),
        updated: nowISO(),
      };
    if (old) db.ideas = db.ideas.map((x) => (x.id === id ? i : x));
    else db.ideas.push(i);
    if (!save()) return;
    $("#ideaDialog").close();
    toast(old ? "Idea updated." : "Idea saved.");
    go("ideas");
  });

  // END: Post and idea form submissions

  // START: JSON backup and restore
  $$("[data-close]").forEach(
    (b) => (b.onclick = () => b.closest("dialog").close()),
  );
  function exportJSON() {
    const blob = new Blob(
        [JSON.stringify({ ...db, exportedAt: nowISO() }, null, 2)],
        { type: "application/json" },
      ),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `linkedin-journal-${lagosToday()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Backup downloaded.");
  }

  // Import validates the backup, asks before replacement, then saves it with current defaults.
  $("#importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (
        !raw ||
        !Array.isArray(raw.posts) ||
        !Array.isArray(raw.ideas) ||
        !raw.settings ||
        !Array.isArray(raw.settings.days)
      )
        throw Error("This file does not look like a journal backup.");
      const days = raw.settings.days;
      if (
        !days.every((x) => Number.isInteger(x) && x >= 0 && x <= 6) ||
        days.length !== 3
      )
        throw Error("Backup must contain three valid publishing days.");
      for (const p of raw.posts) {
        if (
          !p.id ||
          !p.title ||
          !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
          !["Planned", "Ready", "Published"].includes(p.status)
        )
          throw Error("A post record is invalid.");
      }
      for (const i of raw.ideas)
        if (!i.id || !i.title) throw Error("An idea record is invalid.");
      if (
        !confirm(
          "Replace all current posts, ideas and preferences with this backup?",
        )
      )
        return;
      db = {
        ...structuredClone(DEFAULT),
        ...raw,
        settings: { ...DEFAULT.settings, ...raw.settings },
        preferences: { ...DEFAULT.preferences, ...raw.preferences },
      };
      if (!save()) return;
      toast("Backup restored.");
      go("overview");
    } catch (err) {
      toast(`Import failed: ${err.message}`);
    } finally {
      e.target.value = "";
    }
  });

  // END: JSON backup and restore

  // START: Navigation and initialization
  $$(".nav [data-view]").forEach((b) =>
    b.addEventListener("click", () => go(b.dataset.view)),
  );
  // Keep both mobile navigation groups and the menu button state in sync.
  $("#menuBtn").onclick = () => {
    const isOpening = !$(".nav.left").classList.contains("open");
    $(".nav.left").classList.toggle("open", isOpening);
    $(".nav.right").classList.toggle("open", isOpening);
    $("#menuBtn").setAttribute("aria-expanded", String(isOpening));
    $("#menuBtn").setAttribute("aria-label", isOpening ? "Close navigation" : "Open navigation");
  };
  $("#copyrightYear").textContent = String(new Date().getFullYear());
  const initial = location.hash.slice(1);
  go(views[initial] ? initial : "overview");
  // END: Navigation and initialization
})();
