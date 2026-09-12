---
type: entity
tags: [vscode, editor, tool]
status: partial
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# VS Code

- Версия: **1.120.0** (уже была установлена).
- Каталог проектов: `~/zepp-dev`.

## Расширение Zepp OS Dev Tools

`code --install-extension Zepp.zeppos-dev-tools` → расширение **снято с маркетплейса**
(deprecated). Статус: FAIL. Не является обязательным — разработка ведётся через
Zeus CLI в терминале.

## Особенность окружения

При запуске внешних GUI-приложений (симулятор) из VS Code наследуется переменная
`ELECTRON_RUN_AS_NODE=1`, ломающая Electron-приложения. См.
[../entities/zepp-os-simulator.md](../entities/zepp-os-simulator.md).

## Связанные страницы

- [../procedures/setup-ubuntu.md](../procedures/setup-ubuntu.md)
- [../entities/zepp-os-simulator.md](../entities/zepp-os-simulator.md)
