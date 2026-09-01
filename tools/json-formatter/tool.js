export async function mount(container) {
	container.innerHTML = `
    <div class="tool" style="display:flex; flex-direction:column; height:80vh;">
      <div style="display:flex; align-items:center; gap:1rem; padding:0.75rem 1rem; border-bottom:1px solid; flex-wrap:wrap;">
        <label>Indent:
          <select id="indent-select">
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tab</option>
          </select>
        </label>
        <button id="format-btn">Format</button>
        <button id="minify-btn">Minify</button>
        <button id="copy-btn" disabled>Copy</button>
        <span id="status" style="margin-left:auto; font-size:0.9rem;"></span>
      </div>

      <div style="position:relative; flex:1; overflow:auto;">
        <pre id="json-highlight" aria-hidden="true" style="
          margin:0; padding:1rem; box-sizing:border-box;
          font-family:monospace; font-size:0.95rem; line-height:1.4;
          white-space:pre-wrap; word-wrap:break-word;
          position:absolute; inset:0; pointer-events:none;
        "></pre>
        <textarea
          id="json-box"
          placeholder='{"hello": "world"}'
          spellcheck="false"
          style="
            margin:0; padding:1rem; box-sizing:border-box;
            font-family:monospace; font-size:0.95rem; line-height:1.4;
            white-space:pre-wrap; word-wrap:break-word;
            position:absolute; inset:0; width:100%; height:100%;
            border:none; outline:none; resize:none;
            background:transparent; color:transparent; 
          "
        ></textarea>
      </div>
    </div>
  `;

	const box = container.querySelector("#json-box");
	const highlightLayer = container.querySelector("#json-highlight");
	const indentSelect = container.querySelector("#indent-select");
	const formatBtn = container.querySelector("#format-btn");
	const minifyBtn = container.querySelector("#minify-btn");
	const copyBtn = container.querySelector("#copy-btn");
	const status = container.querySelector("#status");

	function currentIndent() {
		const v = indentSelect.value;
		return v === "tab" ? "\t" : Number(v);
	}

	function locateError(text, err) {
		const posMatch = err.message.match(/position (\d+)/);
		if (!posMatch) return err.message;
		const pos = Number(posMatch[1]);
		const upToError = text.slice(0, pos);
		const line = upToError.split("\n").length;
		const col = pos - upToError.lastIndexOf("\n");
		return `${err.message} (line ${line}, column ${col})`;
	}

	function escapeHtml(s) {
		return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}

	function highlight(text) {
		const escaped = escapeHtml(text);
		return escaped.replace(
			/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?)/g,
			(match) => {
				let color = "#f0b429"; // number
				if (/^"/.test(match)) {
					color = /:$/.test(match) ? "#42a5f5" : "#26a69a"; // key / string
				} else if (/true|false/.test(match)) {
					color = "#8e7cff"; // boolean
				} else if (/null/.test(match)) {
					color = "#ff5252"; // null
				}
				return `<span style="color:${color}">${match}</span>`;
			},
		);
	}

	function renderHighlight() {
		highlightLayer.innerHTML = `${highlight(box.value)}\n`;
	}

	function syncScroll() {
		highlightLayer.scrollTop = box.scrollTop;
		highlightLayer.scrollLeft = box.scrollLeft;
	}

	function run(mode) {
		const text = box.value;
		if (!text.trim()) {
			status.textContent = "Nothing to format.";
			return;
		}
		try {
			const parsed = JSON.parse(text);
			box.value =
				mode === "minify"
					? JSON.stringify(parsed)
					: JSON.stringify(parsed, null, currentIndent());
			copyBtn.disabled = false;
			status.textContent = "Valid JSON.";
		} catch (err) {
			copyBtn.disabled = true;
			status.textContent = `Invalid JSON: ${locateError(text, err)}`;
		}
		renderHighlight();
	}

	box.addEventListener("input", renderHighlight);
	box.addEventListener("scroll", syncScroll);
	formatBtn.addEventListener("click", () => run("format"));
	minifyBtn.addEventListener("click", () => run("minify"));
	copyBtn.addEventListener("click", async () => {
		await navigator.clipboard.writeText(box.value);
		status.textContent = "Copied to clipboard.";
	});

	renderHighlight();
}

export async function unmount() {}
