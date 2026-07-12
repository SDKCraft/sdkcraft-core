# sdkcraft-core ⚡

> Generate production-ready SDKs from any OpenAPI spec in seconds.

Open-source core engine of SDKCraft — supports **8 languages**: TypeScript, Python, Go, Java, C#, Kotlin, Swift, and Dart.

---

## ✨ Features

- 📄 OpenAPI 3.0 (JSON & YAML)
- 🌍 8 languages: TypeScript, Python, Go, Java, C#, Kotlin, Swift, Dart
- 🔐 Authentication: API Key & Bearer Token
- 🧱 Typed models/structs/classes in every language
- 🛡️ Structured errors (`SDKError`/`SDKException`) with status code and body
- 🔁 Smart retry logic (idempotent requests only) + pagination helper built-in
- 🎭 **MockClient** in every language — same interface, realistic fake data, for offline development and testing
- ⚡ Generate a full SDK in under a second
- 🛡️ MIT licensed

---

## 🚀 Quick Start

```bash
npm install -g sdkcraft-core
sdkcraft --input ./openapi.json --lang all --output ./sdk
```

---

## 🗺️ Roadmap

- [x] TypeScript, Python, Go, Java, C#, Kotlin, Swift, Dart
- [x] YAML support
- [x] Client class pattern across all languages
- [x] MockClient in every language
- [ ] Rust SDK
- [ ] Plugin API

---

## 📄 License

MIT © SDKCraft