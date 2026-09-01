import { TOOLS } from "./tools/registry.js";

const app = document.getElementById("app");
const search = document.getElementById("tool-search");

let activeTool = null;

function renderHome(filter = "") {
	const q = filter.trim().toLowerCase();
	const visible = TOOLS.filter(
		(t) =>
			t.name.toLowerCase().includes(q) ||
			t.description.toLowerCase().includes(q),
	);

	app.innerHTML = `
    <ul class="tool-list">
      ${visible
				.map(
					(t) => `
          <li class="tool-item">
            <a href="#/${t.id}">
              <h3>${t.name}</h3>
              <p>${t.description}</p>
              <p>${t.version}</p>
            </a>
          </li>
        `,
				)
				.join("")}
    </ul>
  `;
}

async function renderTool(toolId) {
	const tool = TOOLS.find((t) => t.id === toolId);

	if (!tool) {
		app.innerHTML = `<p>Tool not found: ${toolId}</p>`;
		return;
	}

	app.innerHTML = `
    <div class="tool-view-header">
      <h2>${tool.name}</h2>
      <a href="#/" class="back-button">Back</a>
    </div >
    <div class="tool-panel" id="tool-mount">Loading...</div>
  `;

	const mountPoint = document.getElementById("tool-mount");

	try {
		const mod = await import(`./tools/${tool.id}/tool.js`);
		activeTool = { id: toolId, unmount: mod.unmount };
		mountPoint.innerHTML = "";
		await mod.mount(mountPoint);
	} catch (err) {
		console.error("Error mounting tool:", err);
		mountPoint.innerHTML = `<p>Error loading tool: ${err.message}</p>`;
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

window.addEventListener("hashchange", route);
route();
