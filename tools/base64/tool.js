const IMAGE_SIGNATURES = [
	{ mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
	{ mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
	{ mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
	{ mime: "image/bmp", bytes: [0x42, 0x4d] },
	{
		mime: "image/webp",
		bytes: [0x52, 0x49, 0x46, 0x46],
		extra: { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
	},
];

function sniffImageMime(bytes) {
	for (const sig of IMAGE_SIGNATURES) {
		if (bytes.length < sig.bytes.length) continue;
		let match = sig.bytes.every((b, i) => bytes[i] === b);
		if (match && sig.extra) {
			match = sig.extra.bytes.every(
				(b, i) => bytes[sig.extra.offset + i] === b,
			);
		}
		if (match) return sig.mime;
	}
	return null;
}

function formatBytes(n) {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function imageLabel(mime) {
	const label = mime.replace("image/", "").toUpperCase();
	return `${label} Image`;
}

function loadImageDimensions(url) {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () =>
			resolve({ width: img.naturalWidth, height: img.naturalHeight });
		img.onerror = () => resolve(null);
		img.src = url;
	});
}

let wasmExports = null;

async function loadWasm() {
	if (wasmExports) return wasmExports;
	const wasmUrl = new URL("./base64.wasm", import.meta.url);
	const bytes = await fetch(wasmUrl).then((r) => r.arrayBuffer());
	const { instance } = await WebAssembly.instantiate(bytes, {});
	wasmExports = instance.exports;
	return wasmExports;
}

function encodeBytes(exports, bytes) {
	if (bytes.length > exports.input_capacity()) {
		throw new Error(`Input too large (max ${exports.input_capacity()} bytes)`);
	}
	new Uint8Array(exports.memory.buffer).set(bytes, exports.input_ptr());
	const outLen = exports.encode(bytes.length);
	const outPtr = exports.output_ptr();
	return new Uint8Array(exports.memory.buffer).slice(outPtr, outPtr + outLen);
}

function decodeBytes(exports, base64Bytes) {
	if (base64Bytes.length > exports.input_capacity()) {
		throw new Error(`Input too large (max ${exports.input_capacity()} bytes)`);
	}
	new Uint8Array(exports.memory.buffer).set(base64Bytes, exports.input_ptr());
	const outLen = exports.decode(base64Bytes.length);
	if (exports.had_decode_error()) throw new Error("Invalid base64 input");
	const outPtr = exports.output_ptr();
	return new Uint8Array(exports.memory.buffer).slice(outPtr, outPtr + outLen);
}

export async function mount(container) {
	container.innerHTML = `
    <div class="tabs" role="tablist">
      <button type="button" class="tab is-active" data-mode="encode" role="tab" aria-selected="true">Encode</button>
      <button type="button" class="tab" data-mode="decode" role="tab" aria-selected="false">Decode</button>
    </div>

    <div class="field-group">
      <label class="field-label" for="text-input">Input String</label>
      <textarea id="text-input" class="textarea textarea-mono" rows="6" placeholder="Paste raw text or base64 here..."></textarea>
    </div>

    <div class="actions-row">
      <label class="btn btn-secondary btn-file">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4"></path>
          <polyline points="7 9 12 4 17 9"></polyline>
          <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path>
        </svg>
        <span id="file-label">Or upload file...</span>
        <input type="file" id="file-input" class="visually-hidden" />
      </label>

      <div class="actions-row__right">
        <span class="status-line"><span class="status-dot status-dot--success" id="status-dot"></span><span id="status">Ready</span></span>
        <button id="run-btn" type="button" class="btn btn-primary">Run Translation</button>
        <button id="copy-btn" type="button" class="btn btn-secondary" disabled>Copy output</button>
      </div>
    </div>

    <div class="field-group" id="preview-group" hidden>
      <span class="field-label">Source Image Preview</span>
      <div class="preview-card">
        <div class="preview-thumb" id="preview-thumb">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2"></rect>
            <circle cx="9" cy="10" r="1.5"></circle>
            <path d="M21 16l-5-5-4 4-2-2-5 5"></path>
          </svg>
        </div>
        <div class="preview-meta">
          <p class="preview-filename" id="preview-filename"></p>
          <p class="preview-details" id="preview-details"></p>
          <p class="preview-status" id="preview-status" hidden>
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span id="preview-status-text"></span>
          </p>
        </div>
      </div>
    </div>

    <div class="field-group">
      <label class="field-label" for="text-output">Output Result</label>
      <textarea id="text-output" class="textarea textarea-mono" rows="6" readonly placeholder="Output will appear here after clicking Run..."></textarea>
      <div class="image-preview" id="image-preview"></div>
    </div>
  `;

	const tabs = container.querySelectorAll(".tab");
	const textInput = container.querySelector("#text-input");
	const fileInput = container.querySelector("#file-input");
	const fileLabel = container.querySelector("#file-label");
	const runBtn = container.querySelector("#run-btn");
	const copyBtn = container.querySelector("#copy-btn");
	const status = container.querySelector("#status");
	const statusDot = container.querySelector("#status-dot");
	const textOutput = container.querySelector("#text-output");
	const imagePreview = container.querySelector("#image-preview");

	const previewGroup = container.querySelector("#preview-group");
	const previewThumb = container.querySelector("#preview-thumb");
	const previewFilename = container.querySelector("#preview-filename");
	const previewDetails = container.querySelector("#preview-details");
	const previewStatus = container.querySelector("#preview-status");
	const previewStatusText = container.querySelector("#preview-status-text");

	let mode = "encode";
	let pendingFile = null;
	let pendingFileBytes = null;
	let lastUrl = null;
	let previewUrl = null;

	function setStatus(text, variant) {
		status.textContent = text;
		statusDot.className = "status-dot";
		status.className = "";
		if (variant) statusDot.classList.add(`status-dot--${variant}`);
		if (variant === "error") status.classList.add("status-text--error");
	}

	function setMode(next) {
		mode = next;
		tabs.forEach((tab) => {
			const isActive = tab.dataset.mode === mode;
			tab.classList.toggle("is-active", isActive);
			tab.setAttribute("aria-selected", String(isActive));
		});
		textInput.placeholder =
			mode === "encode"
				? "Paste raw text or base64 here..."
				: "Paste base64 to decode here...";
		fileLabel.textContent =
			mode === "encode" && pendingFile
				? `Replace image file (${pendingFile.name})`
				: "Or upload file...";
	}

	tabs.forEach((tab) => {
		tab.addEventListener("click", () => setMode(tab.dataset.mode));
	});

	function hidePreviewCard() {
		previewGroup.hidden = true;
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
			previewUrl = null;
		}
		previewThumb.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2"></rect>
        <circle cx="9" cy="10" r="1.5"></circle>
        <path d="M21 16l-5-5-4 4-2-2-5 5"></path>
      </svg>
    `;
		previewStatus.hidden = true;
	}

	async function showPreviewCard(file, bytes, mime) {
		previewGroup.hidden = false;
		previewFilename.textContent = file.name;

		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
		previewThumb.innerHTML = `<img src="${previewUrl}" alt="" />`;

		const dims = await loadImageDimensions(previewUrl);
		const dimsText = dims ? `${dims.width} × ${dims.height} pixels • ` : "";
		previewDetails.textContent = `${imageLabel(mime)} • ${dimsText}${formatBytes(bytes.length)}`;
		previewStatus.hidden = true;
	}

	fileInput.addEventListener("change", async () => {
		const file = fileInput.files?.[0];
		if (!file) {
			pendingFile = null;
			pendingFileBytes = null;
			hidePreviewCard();
			fileLabel.textContent = "Or upload file...";
			return;
		}
		pendingFile = file;
		pendingFileBytes = new Uint8Array(await file.arrayBuffer());
		textInput.value = "";
		textInput.placeholder = `Using file: ${file.name} (${pendingFileBytes.length} bytes)`;
		fileLabel.textContent =
			mode === "encode"
				? `Replace image file (${file.name})`
				: `Using file: ${file.name}`;

		const mime = sniffImageMime(pendingFileBytes);
		if (mode === "encode" && mime) {
			await showPreviewCard(file, pendingFileBytes, mime);
		} else {
			hidePreviewCard();
		}
	});

	textInput.addEventListener("input", () => {
		pendingFile = null;
		pendingFileBytes = null;
		fileLabel.textContent = "Or upload file...";
		hidePreviewCard();
	});

	function clearOutput() {
		textOutput.value = "";
		imagePreview.innerHTML = "";
		copyBtn.disabled = true;
		if (lastUrl) {
			URL.revokeObjectURL(lastUrl);
			lastUrl = null;
		}
	}

	runBtn.addEventListener("click", async () => {
		clearOutput();
		setStatus("Loading WASM module...", "busy");
		try {
			const exports = await loadWasm();

			if (mode === "encode") {
				const bytes =
					pendingFileBytes ?? new TextEncoder().encode(textInput.value);
				setStatus("Encoding...", "busy");
				const encoded = encodeBytes(exports, bytes);
				textOutput.value = new TextDecoder().decode(encoded);
				copyBtn.disabled = false;

				if (pendingFile) {
					previewStatus.hidden = false;
					previewStatusText.textContent =
						"Base64 data URI is properly synced and ready to copy.";
				}
				setStatus(`Done (${encoded.length} chars)`, "success");
			} else {
				const raw = pendingFileBytes
					? new TextDecoder().decode(pendingFileBytes)
					: textInput.value;
				const base64Bytes = new TextEncoder().encode(raw.trim());
				setStatus("Decoding...", "busy");
				const decoded = decodeBytes(exports, base64Bytes);

				const mime = sniffImageMime(decoded);
				if (mime) {
					lastUrl = URL.createObjectURL(new Blob([decoded], { type: mime }));
					imagePreview.innerHTML = `<img src="${lastUrl}" alt="Decoded image" />`;
					textOutput.value = `(${decoded.length} bytes decoded - detected ${mime}, shown below)`;
				} else {
					try {
						textOutput.value = new TextDecoder("utf-8", { fatal: true }).decode(
							decoded,
						);
					} catch {
						textOutput.value = `(${decoded.length} bytes decoded - not valid UTF-8 text)`;
					}
				}
				copyBtn.disabled = false;
				setStatus(`Done (${decoded.length} bytes)`, "success");
			}
		} catch (err) {
			console.error(err);
			setStatus(`Error: ${err.message}`, "error");
		}
	});

	copyBtn.addEventListener("click", async () => {
		await navigator.clipboard.writeText(textOutput.value);
		setStatus("Copied to clipboard.", "success");
	});

	setMode("encode");
}

export async function unmount() {}
