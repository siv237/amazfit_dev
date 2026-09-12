---
type: entity
tags: [tool, zeus-cli, cli]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# Zeus CLI

Официальный CLI для сборки, отладки и установки мини-приложений и циферблатов Zepp OS.

- Установка: `npm i @zeppos/zeus-cli -g`
- Версия в этой среде: **1.9.3**, движок сборки **zpm 3.4.2**
- Пакет: `~/.nvm/versions/node/v20.20.2/lib/node_modules/@zeppos/zeus-cli`
- Локальный конфиг/токены: `~/.zepp/.zeus`

## Команды

| Команда | Назначение | Статус |
|---|---|---|
| `zeus create <name>` | создать проект | OK, но см. ограничения APILevel |
| `zeus build` | собрать `.zab` | OK, локально |
| `zeus dev` | сборка + деплой в симулятор, watch | OK |
| `zeus login` | вход в аккаунт Zepp | OK |
| `zeus preview` | QR для установки на часы | partial (нужен аккаунт) |
| `zeus bridge` | отладка онлайн-цели | требует аккаунт |
| `zeus status` | состояние логина/симулятора | OK |
| `zeus config list` | список настроек | OK |

## Особенности 1.9.3

- `zeus create` для `--APILevel 3.5` не имеет app-шаблонов (только `workout-extension`);
  рабочие app-шаблоны есть для 3.0 и 4.0.
- `zeus preview` при 401 сам вызывает `zeus login` и открывает браузер
  (`user.zepp.com/universalLogin`). QR = облачная ссылка на скачивание пакета.
- `zeus bridge` использует облачный websocket из `api.getConnectDevServerWebSocketCode()`.
- `zeus dev`/`preview` сами подставляют `deviceSource` выбранного устройства
  (для GTS 4 — 7995648, 7995649), поэтому в `app.json` его задавать не нужно.

## Связанные страницы

- [../procedures/create-build.md](../procedures/create-build.md)
- [../procedures/simulator-dev.md](../procedures/simulator-dev.md)
- [../concepts/device-source.md](../concepts/device-source.md)
