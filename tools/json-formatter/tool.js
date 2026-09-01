export async function mount(container) {
	container.innerHTML = `
    <div class="tool">
      <p>Paste JSON below to validate and pretty-print it.</p>
      <textarea id="json-box" rows="12" placeholder='{"hello": "world"}'></textarea>
      <div class="controls">
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
      </div>
      <p id="status"></p>
    </div>
  `;

	const box = container.querySelector("#json-box");
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
			box.value = "";
			copyBtn.disabled = true;
			status.textContent = `Invalid JSON: ${locateError(text, err)}`;
		}
	}

	formatBtn.addEventListener("click", () => run("format"));
	minifyBtn.addEventListener("click", () => run("minify"));
	copyBtn.addEventListener("click", async () => {
		await navigator.clipboard.writeText(box.value);
		status.textContent = "Copied to clipboard.";
	});
}

export async function unmount() {}
