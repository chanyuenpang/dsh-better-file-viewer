# Fork provenance and licenses

## DeepSeek Harness

Copyright (c) 2026 DeepSeek. MIT License; the complete notice is retained in LICENSE.
Source: https://github.com/deepseek-ai/deepseek-harness

Pinned npm artifacts at 0.2.2-rc.1:
- @deepseek-ai/dsh-client-ui-sidebar-documentpreview
- @deepseek-ai/dsh-client-ui-primitives
- @deepseek-ai/dsh-client-store

scripts/fetch-vendor.mjs pins and verifies the SHA-512 integrity of every archive.
The unmodified published artifacts are kept under vendor/dsh. scripts/fork-preview.mjs
makes an independent build-time fork: separate module, service, locale, CSS and Slot
identities; an independent preview occurrence contract; a reusable preview Factory;
and no Sidebar tab/type/control registration. No DSH installation files are patched.

PDF.js (Apache-2.0), ExcelJS (MIT), SheetJS CE (Apache-2.0), FortuneSheet (MIT),
PapaParse (MIT), YAML and DOMPurify retain their upstream bundled license notices
inside the copied PDF, Excel, frontmatter and preview artifacts. Transitive license
notices for locally bundled dependencies are collected in THIRD_PARTY_LICENSES.txt.

## super-json-editor

Source: https://github.com/chanyuenpang/superjsoneditor, snapshot version 0.1.0.
The file hashes and capture timestamp are in vendor/super-json-editor/provenance.json.
Only the editor/core source directories and upstream stylesheet are copied; the source
project is not modified. Its implementation is compiled with the host's external React,
readOnly enabled, Raw mode disabled, container-local portals, scoped styles/keyframes,
and a minimal theme-token presentation.

The project owner, chanyuenpang, confirmed ownership and authorized public
redistribution of this snapshot and the compiled plugin on 2026-11-13. This
permission covers distribution as part of Better file viewer; it does not assign
an MIT license to the independent editor project, whose supplied manifest has
no license declaration. Third-party dependency licenses remain unchanged.

## Original icon

icon.svg was created specifically for this plugin and is covered by this project's
MIT license. Literal artwork colors are intentional; UI surfaces use DSH theme tokens.
