---
type: concept
tags: [device-source, app-json, build]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# deviceSource и выбор устройства

`deviceSource` — числовой идентификатор модели устройства в экосистеме Zepp/Amazfit.
Для GTS 4: **7995648** (`Lille`) и **7995649** (`Lillew`).

## Где задаётся

- В кэше устройств `~/.zepp/.zeus_devices` — список всех deviceSource.
- В `app.json` → `targets.<target>.platforms[].deviceSource` — по документации
  обязателен для `configVersion v2`, **необязателен для v3**.
- При `zeus dev`/`zeus preview` устройство выбирается интерактивно, и CLI сам
  подставляет его deviceSource в сборку (для GTS 4 — 7995648, 7995649).

## Важный подводный камень (zeus 1.9.3)

Добавление `deviceSource` (или поля `name`) в `platforms` при `configVersion: v3`
**ломает сборку**:

```
Error: The icon in app.json is empty or the image does not exist
```

Причина — в том, как `zpm` резолвит пути к ассетам при явно заданном deviceSource.
Проверено эмпирически: `platforms: [{"st":"r"},{"st":"s"}]` собирается, а
`platforms: [{"deviceSource":7995648,"st":"s"}]` — нет.

**Правильно:** оставить в `app.json` только `st` нужной формы, например для GTS 4:

```json
"platforms": [ { "st": "s" } ]
```

Устройство выбирать при `zeus dev`/`zeus preview`; там же CLI применит нужные
deviceSource.

## Связанные страницы

- [../entities/amazfit-gts4.md](../entities/amazfit-gts4.md)
- [../entities/zeus-cli.md](../entities/zeus-cli.md)
- [../procedures/create-build.md](../procedures/create-build.md)
