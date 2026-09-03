export async function mount(container) {
	container.innerHTML = `
    <div class="toolbar">
      <div class="select-wrap">
        <select id="indent-select" class="select">
          <option value="2">Indent: 2 spaces</option>
          <option value="4">Indent: 4 spaces</option>
          <option value="tab">Indent: Tab</option>
        </select>
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      <button id="format-btn" type="button" class="btn btn-secondary btn-sm">Format</button>
      <button id="minify-btn" type="button" class="btn btn-secondary btn-sm">Minify</button>

      <div class="toolbar__right">
        <span class="status-line"><span class="status-dot" id="status-dot"></span><span id="status">Ready</span></span>
        <button id="copy-btn" type="button" class="btn btn-secondary btn-sm" disabled>Copy Output</button>
      </div>
    </div>

    <div class="code-editor">
      <div class="code-editor__gutter" id="gutter">1</div>
      <div class="code-editor__body">
        <div class="code-editor__content">
          <pre id="json-highlight" class="code-editor__highlight"></pre>
        </div>

        <textarea
          id="json-box"
          class="code-editor__input"
          spellcheck="false"
        ></textarea>
      </div>
    </div>
  `;

	const box = container.querySelector("#json-box");
	const highlightLayer = container.querySelector("#json-highlight");
	const gutter = container.querySelector("#gutter");
	const indentSelect = container.querySelector("#indent-select");
	const formatBtn = container.querySelector("#format-btn");
	const minifyBtn = container.querySelector("#minify-btn");
	const copyBtn = container.querySelector("#copy-btn");
	const status = container.querySelector("#status");
	const statusDot = container.querySelector("#status-dot");

	function setStatus(text, variant) {
		status.textContent = text;
		statusDot.className = "status-dot";
		status.className = "";
		if (variant) statusDot.classList.add(`status-dot--${variant}`);
		if (variant === "error") status.classList.add("status-text--error");
	}

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
				let cls = "tok-number";
				if (/^"/.test(match)) {
					cls = /:$/.test(match) ? "tok-key" : "tok-string";
				} else if (/true|false/.test(match)) {
					cls = "tok-boolean";
				} else if (/null/.test(match)) {
					cls = "tok-null";
				}
				return `<span class="${cls}">${match}</span>`;
			},
		);
	}

	function renderHighlight() {
		highlightLayer.innerHTML = `${highlight(box.value)}\n`;
	}

	function renderGutter() {
		const lineCount = Math.max(1, box.value.split("\n").length);
		let lines = "";
		for (let i = 1; i <= lineCount; i++) lines += `${i}\n`;
		gutter.textContent = lines;
	}

	function syncScroll() {
		highlightLayer.style.transform = `translate(${-box.scrollLeft}px, ${-box.scrollTop}px)`;

		gutter.scrollTop = box.scrollTop;
	}

	function update() {
		renderHighlight();
		renderGutter();
	}

	function run(mode) {
		const text = box.value;
		if (!text.trim()) {
			setStatus("Nothing to format.", "idle");
			return;
		}
		try {
			const parsed = JSON.parse(text);
			box.value =
				mode === "minify"
					? JSON.stringify(parsed)
					: JSON.stringify(parsed, null, currentIndent());
			copyBtn.disabled = false;
			setStatus(`Valid JSON (${new Blob([box.value]).size}B)`, "success");
		} catch (err) {
			copyBtn.disabled = true;
			setStatus(`Invalid JSON: ${locateError(text, err)}`, "error");
		}
		update();
	}

	box.addEventListener("input", update);
	box.addEventListener("scroll", syncScroll);
	formatBtn.addEventListener("click", () => run("format"));
	minifyBtn.addEventListener("click", () => run("minify"));
	copyBtn.addEventListener("click", async () => {
		await navigator.clipboard.writeText(box.value);
		setStatus("Copied to clipboard.", "success");
	});

	update();
}

export async function unmount() {}
