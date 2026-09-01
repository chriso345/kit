export async function mount(container) {
	container.innerHTML = `
    <div class="tool">
      <button id="run-wasm">Run WASM Add</button>
      <pre id="output"></pre>
    </div>
  `;

	const btn = container.querySelector("#run-wasm");
	const output = container.querySelector("#output");

	btn.addEventListener("click", async () => {
		const wasmUrl = new URL("tool.wasm", import.meta.url);
		const wasm = await fetch(wasmUrl).then((r) => r.arrayBuffer());
		const { instance } = await WebAssembly.instantiate(wasm);
		output.textContent = `2 + 3 = ${instance.exports.add(2, 6)}`;
	});
}

export async function unmount() {}
