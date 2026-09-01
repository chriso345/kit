export async function mount(container) {
	container.innerHTML = `
    <div class="tool">
      <p>Convert an MP4 to a GIF entirely in your browser via ffmpeg WebAssembly. Nothing is uploaded.</p>
      <input type="file" id="mp4-input" accept="video/mp4" />
      <div class="controls">
        <label>FPS: <input type="number" id="fps" value="10" min="1" max="30" /></label>
        <label>Width: <input type="number" id="width" value="320" min="16" max="1280" /></label>
      </div>
      <button id="convert-btn" disabled>Convert to GIF</button>
      <p id="status"></p>
      <div id="result"></div>
    </div>
  `;

	const input = container.querySelector("#mp4-input");
	const convertBtn = container.querySelector("#convert-btn");
	const status = container.querySelector("#status");
	const result = container.querySelector("#result");
	const fpsInput = container.querySelector("#fps");
	const widthInput = container.querySelector("#width");

	let ffmpeg = null;
	let file = null;
	let lastUrl = null;

	input.addEventListener("change", () => {
		file = input.files?.[0] ?? null;
		convertBtn.disabled = !file;
		result.innerHTML = "";
	});

	async function fileToUint8Array(f) {
		return new Uint8Array(await f.arrayBuffer());
	}

	async function loadFFmpeg() {
		if (ffmpeg) return ffmpeg;

		status.textContent = "Loading ffmpeg (local)...";

		const { FFmpeg } = await import(
			new URL("./vendor/ffmpeg/index.js", import.meta.url)
		);
		const coreBase = new URL("./vendor/core/", import.meta.url).href;

		ffmpeg = new FFmpeg();
		ffmpeg.on("log", ({ message }) => {
			status.textContent = message;
		});
		ffmpeg.on("progress", ({ progress }) => {
			status.textContent = `Converting... ${(progress * 100).toFixed(0)}%`;
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
		result.innerHTML = "";

		try {
			const ff = await loadFFmpeg();

			const fps = Number(fpsInput.value) || 10;
			const width = Number(widthInput.value) || 320;
			const vf = `fps=${fps},scale=${width}:-1:flags=lanczos`;

			status.textContent = "Writing input file...";
			await ff.writeFile("input.mp4", await fileToUint8Array(file));

			status.textContent = "Generating palette...";
			await ff.exec([
				"-i",
				"input.mp4",
				"-vf",
				`${vf},palettegen`,
				"palette.png",
			]);

			status.textContent = "Encoding GIF...";
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
        <p><a href="${lastUrl}" download="output.gif">Download GIF</a></p>
      `;
			status.textContent = "Done.";

			await ff.deleteFile("input.mp4");
			await ff.deleteFile("palette.png");
			await ff.deleteFile("output.gif");
		} catch (err) {
			console.error("Conversion failed:", err);
			status.textContent = `Error: ${err.message}`;
		} finally {
			convertBtn.disabled = !file;
		}
	});
}

export async function unmount() {}
