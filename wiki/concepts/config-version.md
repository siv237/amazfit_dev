---
type: concept
tags: [app-json, config-version]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# configVersion в app.json

`configVersion` задаёт схему конфигурации проекта Zepp OS.

- `"v3"` — актуальная схема для Zepp OS 3.x (в ней, в частности, `deviceSource` в
  `platforms` необязателен).
- `"v2"` — старая схема, где `deviceSource` был обязателен.

Проекты, сгенерированные `zeus create` 1.9.3, уже содержат `"configVersion": "v3"`.

## Связь с шаблонами

Тело шаблона для `configVersion v3` лежит в zeus по пути
`.../zeppos-app-utils/dist/public/template/config-version-v3/v2/app/<name>/`, где
в `app.json` используется `platforms: [{"st":"r"},{"st":"s"}]` без `deviceSource` —
подтверждение, что для v3 deviceSource не нужен.

## Связанные страницы

- [../concepts/device-source.md](../concepts/device-source.md)
- [../entities/hello-world-project.md](../entities/hello-world-project.md)
