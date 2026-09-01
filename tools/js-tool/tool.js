export function mount(container) {
	container.innerHTML = `
    <div class="tool">
      <p>This is a sample JS tool running in Kit.</p>
      <button id="hello-btn">Say Hello</button>
      <pre id="output"></pre>
    </div>
  `;
	const btn = container.querySelector("#hello-btn");
	const output = container.querySelector("#output");
	btn.addEventListener("click", () => {
		output.textContent = "Hello from JS Tool!";
	});
}
