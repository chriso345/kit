# kit

**kit** is a lightweight, browser-based collection of small self-contained tools. 

---

## Installation

**kit** requires a modern browser that support WASM modules, and Zig 0.16.0 for building the tools and generating the registry. Note that some tools have additional build-time dependencies that are not explicitly mentioned.

```bash
git clone https://github.com/chriso345/kit.git
cd kit

zig build         # discovers tools, runs builds, generates the registry
zig build serve   # serves the site locally
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
