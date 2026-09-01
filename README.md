# kit

**kit** is a lightweight, browser-based collection of small self-contained tools. 

---

## Installation

Requires only a modern browser and optionally Python (for the local dev server). Some tools have their own build-time dependencies (e.g. `clang` for WASM tools, `npm` for tools that vendor JS packages).

```bash
git clone https://github.com/chriso345/kit.git
cd kit

./scripts/build-registry.sh   # discovers tools, runs builds, generates the registry
./scripts/run.sh --open       # serves the site locally
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
