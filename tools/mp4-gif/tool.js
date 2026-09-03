export async function mount(container) {
	container.innerHTML = `
    <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Upload an MP4 file">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 18a4.5 4.5 0 0 1-1.5-8.75A5.5 5.5 0 0 1 16.4 8.02 4 4 0 0 1 17 16"></path>
        <polyline points="9 15 12 12 15 15"></polyline>
        <line x1="12" y1="12" x2="12" y2="21"></line>
      </svg>
      <p class="dropzone__title" id="dropzone-title">Drag &amp; drop MP4 file here, or click to browse</p>
      <p class="dropzone__hint">WASM file translation - Max 50MB suggested</p>
      <input type="file" id="mp4-input" accept="video/mp4" class="visually-hidden" />
    </div>

    <div class="field-row">
      <div class="field-group field-group--inline">
        <label class="field-label" for="fps">Target FPS</label>
        <input type="number" id="fps" class="input" value="10" min="1" max="30" />
      </div>
      <div class="field-group field-group--inline">
        <label class="field-label" for="width">Width (Pixels)</label>
        <input type="number" id="width" class="input" value="320" min="16" max="1280" />
      </div>

      <div class="field-row__right">
        <span class="status-line"><span class="status-dot status-dot--idle" id="status-dot"></span><span id="status">Idle / Ready for file</span></span>
        <button id="convert-btn" type="button" class="btn btn-primary" disabled>Convert to GIF</button>
      </div>
    </div>

    <div class="preview-box" id="result">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2"></rect>
        <circle cx="9" cy="10" r="1.5"></circle>
        <path d="M21 16l-5-5-4 4-2-2-5 5"></path>
      </svg>
      <p>Output preview will appear here once converted.</p>
    </div>
  `;

	const dropzone = container.querySelector("#dropzone");
	const dropzoneTitle = container.querySelector("#dropzone-title");
	const input = container.querySelector("#mp4-input");
	const convertBtn = container.querySelector("#convert-btn");
	const status = container.querySelector("#status");
	const statusDot = container.querySelector("#status-dot");
	const result = container.querySelector("#result");
	const fpsInput = container.querySelector("#fps");
	const widthInput = container.querySelector("#width");

	let ffmpeg = null;
	let file = null;
	let lastUrl = null;

	function setStatus(text, variant) {
		status.textContent = text;
		statusDot.className = "status-dot";
		status.className = "";
		if (variant) statusDot.classList.add(`status-dot--${variant}`);
		if (variant === "error") status.classList.add("status-text--error");
	}

	function resetPreview() {
		result.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2"></rect>
        <circle cx="9" cy="10" r="1.5"></circle>
        <path d="M21 16l-5-5-4 4-2-2-5 5"></path>
      </svg>
      <p>Output preview will appear here once converted.</p>
    `;
	}

	function setFile(f) {
		file = f ?? null;
		convertBtn.disabled = !file;
		resetPreview();
		dropzoneTitle.textContent = file
			? `${file.name} - click or drop to replace`
			: "Drag & drop MP4 file here, or click to browse";
		setStatus(file ? "Ready to convert" : "Idle", file ? "success" : "idle");
	}

	dropzone.addEventListener("click", () => input.click());
	dropzone.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			input.click();
		}
	});

	["dragenter", "dragover"].forEach((evt) => {
		dropzone.addEventListener(evt, (e) => {
			e.preventDefault();
			dropzone.classList.add("is-dragover");
		});
	});

	["dragleave", "dragend", "drop"].forEach((evt) => {
		dropzone.addEventListener(evt, (e) => {
			e.preventDefault();
			dropzone.classList.remove("is-dragover");
		});
	});

	dropzone.addEventListener("drop", (e) => {
		const dropped = e.dataTransfer?.files?.[0];
		if (dropped && dropped.type === "video/mp4") {
			setFile(dropped);
		} else if (dropped) {
			setStatus("Please drop an MP4 file.", "error");
		}
	});

	input.addEventListener("change", () => {
		setFile(input.files?.[0] ?? null);
	});

	async function fileToUint8Array(f) {
		return new Uint8Array(await f.arrayBuffer());
	}

	async function loadFFmpeg() {
		if (ffmpeg) return ffmpeg;

		setStatus("Loading ffmpeg (local)...", "busy");

		const { FFmpeg } = await import(
			new URL("./vendor/ffmpeg/index.js", import.meta.url)
		);
		const coreBase = new URL("./vendor/core/", import.meta.url).href;

		ffmpeg = new FFmpeg();
		ffmpeg.on("log", ({ message }) => {
			setStatus(message, "busy");
		});
		ffmpeg.on("progress", ({ progress }) => {
			setStatus(`Converting... ${(progress * 100).toFixed(0)}%`, "busy");
		});

		await ffmpeg.load({
			coreURL: `${coreBase}ffmpeg-core.js`,
			wasmURL: `${coreBase}ffmpeg-core.wasm`,
		});

		return ffmpeg;
	}

	convertBtn.addEventListener("click", async () => {
		if (!file) return;
		convertBtn.disabled = true;
		resetPreview();

		try {
			const ff = await loadFFmpeg();

			const fps = Number(fpsInput.value) || 10;
			const width = Number(widthInput.value) || 320;
			const vf = `fps=${fps},scale=${width}:-1:flags=lanczos`;

			setStatus("Writing input file...", "busy");
			await ff.writeFile("input.mp4", await fileToUint8Array(file));

			setStatus("Generating palette...", "busy");
			await ff.exec([
				"-i",
				"input.mp4",
				"-vf",
				`${vf},palettegen`,
				"palette.png",
			]);

			setStatus("Encoding GIF...", "busy");
			await ff.exec([
				"-i",
				"input.mp4",
				"-i",
				"palette.png",
				"-filter_complex",
				`${vf}[x];[x][1:v]paletteuse`,
				"output.gif",
			]);

			const data = await ff.readFile("output.gif");
			if (lastUrl) URL.revokeObjectURL(lastUrl);
			const blob = new Blob([data.buffer], { type: "image/gif" });
			lastUrl = URL.createObjectURL(blob);

			result.innerHTML = `
        <img src="${lastUrl}" alt="Converted GIF" />
        <a href="${lastUrl}" download="output.gif">Download GIF</a>
      `;
			setStatus("Done", "success");

			await ff.deleteFile("input.mp4");
			await ff.deleteFile("palette.png");
			await ff.deleteFile("output.gif");
		} catch (err) {
			console.error("Conversion failed:", err);
			setStatus(`Error: ${err.message}`, "error");
		} finally {
			convertBtn.disabled = !file;
		}
	});

	setFile(null);
}

export async function unmount() {}
