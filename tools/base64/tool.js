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
    <div class="tool">
      <p>Base64 encode/decode, computed locally through a WebAssembly module compiled from Zig.</p>
      <div class="controls">
        <label><input type="radio" name="mode" value="encode" checked /> Encode</label>
        <label><input type="radio" name="mode" value="decode" /> Decode</label>
      </div>
      <textarea id="text-input" rows="6" placeholder="Paste text or base64 here..."></textarea>
      <div class="controls">
        <input type="file" id="file-input" />
        <button id="run-btn">Run</button>
        <button id="copy-btn" disabled>Copy output</button>
      </div>
      <p id="status"></p>
      <textarea id="text-output" rows="6" readonly placeholder="Output..."></textarea>
      <div id="image-preview"></div>
    </div>
  `;

	const textInput = container.querySelector("#text-input");
	const fileInput = container.querySelector("#file-input");
	const runBtn = container.querySelector("#run-btn");
	const copyBtn = container.querySelector("#copy-btn");
	const status = container.querySelector("#status");
	const textOutput = container.querySelector("#text-output");
	const imagePreview = container.querySelector("#image-preview");

	let pendingFileBytes = null;
	let lastUrl = null;

	function currentMode() {
		return container.querySelector('input[name="mode"]:checked').value;
	}

	fileInput.addEventListener("change", async () => {
		const file = fileInput.files?.[0];
		if (!file) {
			pendingFileBytes = null;
			return;
		}
		pendingFileBytes = new Uint8Array(await file.arrayBuffer());
		textInput.value = "";
		textInput.placeholder = `Using file: ${file.name} (${pendingFileBytes.length} bytes)`;
	});

	textInput.addEventListener("input", () => {
		pendingFileBytes = null;
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
		status.textContent = "Loading wasm module...";
		try {
			const exports = await loadWasm();
			const mode = currentMode();

			if (mode === "encode") {
				const bytes =
					pendingFileBytes ?? new TextEncoder().encode(textInput.value);
				status.textContent = "Encoding...";
				const encoded = encodeBytes(exports, bytes);
				textOutput.value = new TextDecoder().decode(encoded);
				copyBtn.disabled = false;

				const mime = sniffImageMime(bytes);
				if (mime) {
					lastUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
					imagePreview.innerHTML = `<img src="${lastUrl}" alt="Source image preview" />`;
				}
				status.textContent = `Done (${encoded.length} chars).`;
			} else {
				const raw = pendingFileBytes
					? new TextDecoder().decode(pendingFileBytes)
					: textInput.value;
				const base64Bytes = new TextEncoder().encode(raw.trim());
				status.textContent = "Decoding...";
				const decoded = decodeBytes(exports, base64Bytes);

				const mime = sniffImageMime(decoded);
				if (mime) {
					lastUrl = URL.createObjectURL(new Blob([decoded], { type: mime }));
					imagePreview.innerHTML = `<img src="${lastUrl}" alt="Decoded image" />`;
					textOutput.value = `(${decoded.length} bytes decoded - detected ${mime}, shown above)`;
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
				status.textContent = `Done (${decoded.length} bytes).`;
			}
		} catch (err) {
			console.error(err);
			status.textContent = `Error: ${err.message}`;
		}
	});

	copyBtn.addEventListener("click", async () => {
		await navigator.clipboard.writeText(textOutput.value);
		status.textContent = "Copied to clipboard.";
	});
}

export async function unmount() {}
