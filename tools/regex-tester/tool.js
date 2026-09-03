export async function mount(container) {
	container.innerHTML = `
    <div class="field-group">
      <label class="field-label">Pattern</label>
      <div class="regex-pattern-row">
        <span class="regex-delimiter">/</span>
        <input
          id="pattern-input"
          class="input regex-pattern-input"
          type="text"
          spellcheck="false"
          placeholder="pattern"
        />
        <span class="regex-delimiter">/</span>
        <input
          id="flags-input"
          class="input regex-flags-input"
          type="text"
          spellcheck="false"
          placeholder="flags"
          maxlength="6"
        />
      </div>
    </div>

    <div class="field-group">
      <label class="field-label">Test String <span id="match-count" class="match-count"></span></label>
      <div class="code-editor">
        <div class="code-editor__gutter" id="test-gutter">1</div>
        <div class="code-editor__body">
          <div class="code-editor__content">
            <pre id="test-highlight" class="code-editor__highlight"></pre>
          </div>
          <textarea
            id="test-box"
            class="code-editor__input"
            spellcheck="false"
            placeholder="Enter test string..."
          ></textarea>
        </div>
      </div>
    </div>

    <div class="field-group" id="groups-section" style="display: none;">
      <label class="field-label">Capture Groups</label>
      <div id="groups-list" class="groups-list"></div>
    </div>
  `;

	const patternInput = container.querySelector("#pattern-input");
	const flagsInput = container.querySelector("#flags-input");
	const testBox = container.querySelector("#test-box");
	const testHighlight = container.querySelector("#test-highlight");
	const testGutter = container.querySelector("#test-gutter");
	const matchCount = container.querySelector("#match-count");
	const groupsSection = container.querySelector("#groups-section");
	const groupsList = container.querySelector("#groups-list");

	function escapeHtml(s) {
		return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
	}

	function renderGutter(textarea, gutter) {
		const lineCount = Math.max(1, textarea.value.split("\n").length);
		let lines = "";
		for (let i = 1; i <= lineCount; i++) lines += `${i}\n`;
		gutter.textContent = lines;
	}

	function syncScroll(textarea, highlightLayer, gutter) {
		highlightLayer.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
		gutter.scrollTop = textarea.scrollTop;
	}

	function highlightMatches(text, regex) {
		if (!text || !regex) return escapeHtml(text);

		const globalRegex = new RegExp(
			regex.source,
			regex.flags + (regex.flags.includes("g") ? "" : "g"),
		);
		const matches = [...text.matchAll(globalRegex)];
		let result = "";
		let lastIndex = 0;

		for (const match of matches) {
			const matchStart = match.index ?? 0;
			const matchEnd = matchStart + match[0].length;

			if (matchStart > lastIndex) {
				result += escapeHtml(text.slice(lastIndex, matchStart));
			}
			result += `<span class="tok-match">${escapeHtml(text.slice(matchStart, matchEnd))}</span>`;
			lastIndex = matchEnd;

			if (!regex.flags.includes("g")) break;
		}

		if (lastIndex < text.length) {
			result += escapeHtml(text.slice(lastIndex));
		}

		return result || escapeHtml(text);
	}

	function updateGroups(match) {
		if (!match || match.length <= 1) {
			groupsSection.style.display = "none";
			return;
		}

		groupsSection.style.display = "block";
		groupsList.innerHTML = match
			.slice(1)
			.map(
				(group, i) => `
			<div class="group-item">
				<span class="group-number">$${i + 1}</span>
				<span class="group-value">${escapeHtml(group ?? "")}</span>
			</div>
		`,
			)
			.join("");
	}

	function update() {
		const pattern = patternInput.value;
		const flags = flagsInput.value;
		const testStr = testBox.value;

		if (!pattern) {
			testHighlight.innerHTML = `${escapeHtml(testStr)}\n`;
			matchCount.textContent = "";
			groupsSection.style.display = "none";
			patternInput.style.borderColor = "";
			testBox.style.borderColor = "";
			renderGutter(testBox, testGutter);
			syncScroll(testBox, testHighlight, testGutter);
			return;
		}

		try {
			const regex = new RegExp(pattern, flags);
			patternInput.style.borderColor = "";

			// testHighlight.innerHTML = highlightMatches(testStr, regex) + "\n";
			testHighlight.innerHTML = `${highlightMatches(testStr, regex)}\n`;

			const globalRegex = new RegExp(
				pattern,
				flags + (flags.includes("g") ? "" : "g"),
			);
			const matches = [...testStr.matchAll(globalRegex)];

			matchCount.textContent =
				matches.length === 0
					? " (no matches)"
					: ` (${matches.length} match${matches.length !== 1 ? "es" : ""})`;

			if (matches.length > 0) {
				updateGroups(matches[0]);
			} else {
				groupsSection.style.display = "none";
			}
		} catch {
			patternInput.style.borderColor = "var(--danger)";
			testHighlight.innerHTML = `${escapeHtml(testStr)}\n`;
			matchCount.textContent = "";
			groupsSection.style.display = "none";
		}

		renderGutter(testBox, testGutter);
		syncScroll(testBox, testHighlight, testGutter);
	}

	patternInput.addEventListener("input", update);
	flagsInput.addEventListener("input", update);
	testBox.addEventListener("input", update);
	testBox.addEventListener("scroll", () =>
		syncScroll(testBox, testHighlight, testGutter),
	);

	update();
}

export async function unmount() {}

