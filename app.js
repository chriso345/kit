import { TOOLS } from "./tools/registry.js";

const HIDDEN_FROM_GRID = new Set(["js-tool", "wasm-tool"]);

const THEME_KEY = "kit-theme";
const themeToggle = document.getElementById("theme-toggle");

function applyTheme(theme) {
	document.documentElement.dataset.theme = theme;
	themeToggle.setAttribute(
		"aria-label",
		theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
	);
}

function currentTheme() {
	return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

applyTheme(currentTheme());

themeToggle.addEventListener("click", () => {
	const next = currentTheme() === "dark" ? "light" : "dark";
	localStorage.setItem(THEME_KEY, next);
	applyTheme(next);
});

const app = document.getElementById("app");
const search = document.getElementById("tool-search");
const headerCrumb = document.getElementById("header-crumb");
const sourceLink = document.getElementById("source-link");

let activeTool = null;

function setCrumb(text) {
	if (text) {
		headerCrumb.textContent = text;
		headerCrumb.hidden = false;
	} else {
		headerCrumb.hidden = true;
	}
}

function setSourceLink(toolId) {
	var baseUrl = "https://github.com/chriso345/kit/";

	if (toolId) {
		baseUrl += `tree/master/tools/${toolId}`;
	}

	sourceLink.href = baseUrl;
}

function escapeHtml(s) {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHome(filter = "") {
	setCrumb(null);
	setSourceLink(null);

	const q = filter.trim().toLowerCase();
	const visible = TOOLS.filter(
		(t) =>
			!HIDDEN_FROM_GRID.has(t.id) &&
			(t.name.toLowerCase().includes(q) ||
				t.description.toLowerCase().includes(q)),
	);

	const cards = visible
		.map(
			(t) => `
        <li>
          <a class="tool-card" href="#/${t.id}">
            <div class="tool-card__top">
              <h3 class="tool-card__name">${escapeHtml(t.name)}</h3>
              <span class="badge">v${escapeHtml(t.version)}</span>
            </div>
            <p class="tool-card__desc">${escapeHtml(t.description)}</p>
            <span class="tool-card__link">
              Open tool
              <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </span>
          </a>
        </li>
      `,
		)
		.join("");

	app.innerHTML = `
    <h1 class="page-title">kit /</h1>
    <ul class="tool-grid">
      ${cards || '<li class="empty-state">No tools match your search.</li>'}
    </ul>
  `;
}

async function renderTool(toolId) {
	const tool = TOOLS.find((t) => t.id === toolId);

	if (!tool) {
		setCrumb(null);
		app.innerHTML = `<p class="tool-error">Tool not found: ${escapeHtml(toolId)}</p>`;
		return;
	}

	setCrumb(tool.name);
	setSourceLink(toolId);

	app.innerHTML = `
    <div class="tool-view-header">
      <a href="#/" class="back-link">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Back to home
      </a>
      <h1 class="page-title">${escapeHtml(tool.name)}</h1>
      <p class="page-subtitle">${escapeHtml(tool.description)}</p>
    </div>
    <div class="tool-panel" id="tool-mount">
      <p class="tool-loading">Loading...</p>
    </div>
  `;

	const mountPoint = document.getElementById("tool-mount");

	try {
		const mod = await import(`./tools/${tool.id}/tool.js`);
		activeTool = { id: toolId, unmount: mod.unmount };
		mountPoint.innerHTML = "";
		await mod.mount(mountPoint);
	} catch (err) {
		console.error("Error mounting tool:", err);
		mountPoint.innerHTML = `<p class="tool-error">Error loading tool: ${escapeHtml(err.message)}</p>`;
	}
}

function parseRoute() {
	const hash = location.hash.replace(/^#\/?/, "");
	return hash || null;
}

async function route() {
	if (activeTool?.unmount) {
		try {
			await activeTool.unmount();
		} catch (err) {
			console.error("Error unmounting tool:", err);
		}
	}
	activeTool = null;

	const id = parseRoute();

	if (id) {
		await renderTool(id);
	} else {
		renderHome(search.value);
	}
	app.focus();
}

search.addEventListener("input", () => {
	if (!parseRoute()) renderHome(search.value);
});

window.addEventListener("keydown", (e) => {
	const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
	if (isShortcut) {
		e.preventDefault();
		search.focus();
		search.select();
	}
});

window.addEventListener("hashchange", route);
route();
