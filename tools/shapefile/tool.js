import {
	computeBounds,
	parseDbf,
	parsePrjName,
	parseShapefile,
} from "./shapefile.js";

const POINT_TYPES = new Set([1, 11, 21]);
const POLYGON_TYPES = new Set([5, 15, 25]);

function escapeHtml(s) {
	return String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function buildGeometrySvg(shapefile, width, height, padding = 16) {
	const bbox = computeBounds(shapefile);
	const spanX = bbox.xmax - bbox.xmin || 1;
	const spanY = bbox.ymax - bbox.ymin || 1;
	const scale = Math.min(
		(width - padding * 2) / spanX,
		(height - padding * 2) / spanY,
	);

	const project = (pt) => {
		const x = (pt.x - bbox.xmin) * scale + padding;
		const y = height - ((pt.y - bbox.ymin) * scale + padding);
		return `${x.toFixed(1)},${y.toFixed(1)}`;
	};

	const isPoint = POINT_TYPES.has(shapefile.shapeType);
	const isPolygon = POLYGON_TYPES.has(shapefile.shapeType);

	const markup = shapefile.shapes
		.flatMap((shape) => {
			if (shape.unsupported || shape.parts.length === 0) return [];

			if (isPoint) {
				const [x, y] = project(shape.parts[0][0]).split(",");
				return [
					`<circle cx="${x}" cy="${y}" r="3.5" class="shape-point" vector-effect="non-scaling-stroke" />`,
				];
			}

			return shape.parts.map((part) => {
				if (part.length === 0) return "";
				const d = part
					.map((pt, i) => `${i === 0 ? "M" : "L"}${project(pt)}`)
					.join(" ");
				return `<path d="${isPolygon ? `${d} Z` : d}" class="${
					isPolygon ? "shape-polygon" : "shape-line"
				}" vector-effect="non-scaling-stroke" />`;
			});
		})
		.join("");

	return `<svg viewBox="0 0 ${width} ${height}" class="shapefile-svg" role="img" aria-label="Shapefile geometry preview"><g class="shapefile-geom-group">${markup}</g></svg>`;
}

/** Render an attribute table from parsed .dbf records, capped for DOM size. */
function buildAttributeTable(dbf, maxRows = 500) {
	if (!dbf || dbf.fields.length === 0) {
		return `<p class="empty-state">No .dbf file loaded: attributes will appear here once one is added.</p>`;
	}

	const columns = ["FID", ...dbf.fields.map((f) => f.name)];
	const rows = dbf.records.slice(0, maxRows);

	const head = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
	const body = rows
		.map((record, i) => {
			const cells = columns
				.map((col) =>
					col === "FID"
						? `<td>${i}</td>`
						: `<td>${escapeHtml(record[col] ?? "")}</td>`,
				)
				.join("");
			return `<tr>${cells}</tr>`;
		})
		.join("");

	const truncated =
		dbf.records.length > maxRows
			? `<p class="preview-details">Showing first ${maxRows} of ${dbf.records.length} records.</p>`
			: "";

	return `
    <div class="shapefile-table-scroll">
      <table class="shapefile-table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    ${truncated}
  `;
}

export async function mount(container) {
	container.innerHTML = `
    <div class="actions-row">
      <label class="btn btn-secondary btn-file">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4"></path>
          <polyline points="7 9 12 4 17 9"></polyline>
          <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path>
        </svg>
        <span id="shp-label">Upload .shp file...</span>
        <input type="file" id="shp-input" accept=".shp" class="visually-hidden" />
      </label>
      <label class="btn btn-secondary btn-file">
        <span id="dbf-label">+ Add .dbf attributes</span>
        <input type="file" id="dbf-input" accept=".dbf" class="visually-hidden" />
      </label>
      <label class="btn btn-secondary btn-file">
        <span id="prj-label">+ Add .prj projection</span>
        <input type="file" id="prj-input" accept=".prj" class="visually-hidden" />
      </label>

      <div class="actions-row__right">
        <button id="clear-btn" type="button" class="btn btn-secondary" disabled>Clear Session</button>
      </div>
    </div>

    <p class="empty-state" id="empty-state">
      Upload a .shp file to preview its geometry. Add a matching .dbf file to browse its attribute table,
      and a .prj file to see its coordinate reference system.
    </p>

    <div class="shapefile-layout" id="layout" hidden>
      <div class="shapefile-canvas-wrap">
        <span class="field-label">Geometry Preview</span>
        <div class="shapefile-canvas">
          <div id="geometry-preview" class="shapefile-canvas-inner"></div>
          <div class="shapefile-zoom-controls">
            <button type="button" class="zoom-btn" id="zoom-in-btn" aria-label="Zoom in" disabled>+</button>
            <button type="button" class="zoom-btn" id="zoom-out-btn" aria-label="Zoom out" disabled>&minus;</button>
            <button type="button" class="zoom-btn" id="zoom-reset-btn" aria-label="Reset view" disabled>
              <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
                <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>
                <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
                <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
              </svg>
            </button>
          </div>
        </div>
        <p class="preview-details">Scroll to zoom, drag to pan, double-click to reset.</p>
      </div>
      <div class="shapefile-table-wrap">
        <span class="field-label" id="table-title">Attribute Table</span>
        <div id="attribute-table"></div>
      </div>
    </div>

    <div class="shapefile-meta" id="meta" hidden>
      <span id="meta-crs"></span>
      <span id="meta-bounds"></span>
    </div>
  `;

	const shpInput = container.querySelector("#shp-input");
	const dbfInput = container.querySelector("#dbf-input");
	const prjInput = container.querySelector("#prj-input");
	const shpLabel = container.querySelector("#shp-label");
	const dbfLabel = container.querySelector("#dbf-label");
	const prjLabel = container.querySelector("#prj-label");
	const clearBtn = container.querySelector("#clear-btn");
	const emptyState = container.querySelector("#empty-state");
	const layout = container.querySelector("#layout");
	const geometryPreview = container.querySelector("#geometry-preview");
	const attributeTable = container.querySelector("#attribute-table");
	const tableTitle = container.querySelector("#table-title");
	const meta = container.querySelector("#meta");
	const metaCrs = container.querySelector("#meta-crs");
	const metaBounds = container.querySelector("#meta-bounds");
	const zoomInBtn = container.querySelector("#zoom-in-btn");
	const zoomOutBtn = container.querySelector("#zoom-out-btn");
	const zoomResetBtn = container.querySelector("#zoom-reset-btn");

	let shapefile = null;
	let dbf = null;
	let crsName = null;
	let geomGroup = null;

	const MIN_SCALE = 1;
	const MAX_SCALE = 25;
	const view = { scale: 1, panX: 0, panY: 0 };

	function clamp(v, min, max) {
		return Math.min(max, Math.max(min, v));
	}

	function applyTransform() {
		if (!geomGroup) return;
		geomGroup.setAttribute(
			"transform",
			`translate(${view.panX} ${view.panY}) scale(${view.scale})`,
		);
	}

	function resetView() {
		view.scale = 1;
		view.panX = 0;
		view.panY = 0;
		applyTransform();
	}

	function zoomAt(x, y, factor) {
		if (!geomGroup) return;
		const newScale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
		const applied = newScale / view.scale;
		view.panX = x - (x - view.panX) * applied;
		view.panY = y - (y - view.panY) * applied;
		view.scale = newScale;
		applyTransform();
	}

	function zoomStep(factor) {
		const rect = geometryPreview.getBoundingClientRect();
		zoomAt(rect.width / 2, rect.height / 2, factor);
	}

	function formatCoord(n) {
		return Number.isFinite(n) ? n.toFixed(4) : "-";
	}

	function render() {
		if (!shapefile) {
			emptyState.hidden = false;
			layout.hidden = true;
			meta.hidden = true;
			geomGroup = null;
			zoomInBtn.disabled = true;
			zoomOutBtn.disabled = true;
			zoomResetBtn.disabled = true;
			return;
		}

		emptyState.hidden = true;
		layout.hidden = false;
		meta.hidden = false;

		const width = geometryPreview.clientWidth || 300;
		const height = geometryPreview.clientHeight || 225;
		geometryPreview.innerHTML = buildGeometrySvg(shapefile, width, height);
		geomGroup = geometryPreview.querySelector(".shapefile-geom-group");
		resetView();

		zoomInBtn.disabled = false;
		zoomOutBtn.disabled = false;
		zoomResetBtn.disabled = false;

		const featureCount = shapefile.shapes.filter((s) => !s.unsupported).length;
		tableTitle.textContent = dbf
			? `Attribute Table (.dbf): ${featureCount} features`
			: `Geometry loaded: ${featureCount} features (no .dbf attached)`;
		attributeTable.innerHTML = buildAttributeTable(dbf);

		const bounds = computeBounds(shapefile);
		metaCrs.textContent = crsName
			? `CRS: ${crsName}`
			: "CRS: unknown (no .prj provided)";
		metaBounds.textContent = `Bounds: ${formatCoord(bounds.xmin)}, ${formatCoord(bounds.ymin)} → ${formatCoord(bounds.xmax)}, ${formatCoord(bounds.ymax)}`;

		clearBtn.disabled = false;
	}

	function pointerPos(evt) {
		const rect = geometryPreview.getBoundingClientRect();
		return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
	}

	geometryPreview.addEventListener(
		"wheel",
		(e) => {
			if (!geomGroup) return;
			e.preventDefault();
			const { x, y } = pointerPos(e);
			const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
			zoomAt(x, y, factor);
		},
		{ passive: false },
	);

	let dragState = null;

	geometryPreview.addEventListener("pointerdown", (e) => {
		if (!geomGroup) return;
		dragState = {
			startX: e.clientX,
			startY: e.clientY,
			startPanX: view.panX,
			startPanY: view.panY,
		};
		geometryPreview.setPointerCapture(e.pointerId);
		geometryPreview.classList.add("is-panning");
	});

	geometryPreview.addEventListener("pointermove", (e) => {
		if (!dragState) return;
		view.panX = dragState.startPanX + (e.clientX - dragState.startX);
		view.panY = dragState.startPanY + (e.clientY - dragState.startY);
		applyTransform();
	});

	function endDrag() {
		dragState = null;
		geometryPreview.classList.remove("is-panning");
	}

	geometryPreview.addEventListener("pointerup", endDrag);
	geometryPreview.addEventListener("pointercancel", endDrag);
	geometryPreview.addEventListener("pointerleave", endDrag);
	geometryPreview.addEventListener("dblclick", resetView);

	zoomInBtn.addEventListener("click", () => zoomStep(1.4));
	zoomOutBtn.addEventListener("click", () => zoomStep(1 / 1.4));
	zoomResetBtn.addEventListener("click", resetView);

	shpInput.addEventListener("change", async () => {
		const file = shpInput.files?.[0];
		if (!file) return;
		try {
			shapefile = parseShapefile(await file.arrayBuffer());
			shpLabel.textContent = file.name;
			render();
		} catch {
			shapefile = null;
			render();
		}
	});

	dbfInput.addEventListener("change", async () => {
		const file = dbfInput.files?.[0];
		if (!file) return;
		try {
			dbf = parseDbf(await file.arrayBuffer());
			dbfLabel.textContent = file.name;
			render();
		} catch {
			dbf = null;
		}
	});

	prjInput.addEventListener("change", async () => {
		const file = prjInput.files?.[0];
		if (!file) return;
		try {
			crsName = parsePrjName(await file.text());
			prjLabel.textContent = file.name;
			render();
		} catch {
			crsName = null;
		}
	});

	clearBtn.addEventListener("click", () => {
		shapefile = null;
		dbf = null;
		crsName = null;
		shpInput.value = "";
		dbfInput.value = "";
		prjInput.value = "";
		shpLabel.textContent = "Upload .shp file...";
		dbfLabel.textContent = "+ Add .dbf attributes";
		prjLabel.textContent = "+ Add .prj projection";
		clearBtn.disabled = true;
		render();
	});

	window.addEventListener("resize", () => {
		if (shapefile) render();
	});

	render();
}

export async function unmount() {}
