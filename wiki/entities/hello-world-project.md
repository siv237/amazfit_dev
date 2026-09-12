---
type: entity
tags: [project, test, gts4]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# Проект hello-world

Тестовый проект для проверки среды. Успешно запущен на эмуляторе GTS 4.

- Путь: `~/zepp-dev/hello-world`
- appId: `26430`, appName `Hello World`, appType `app`
- Создан: `zeus create hello-world --APILevel 3.0 --appType APP --template Hello_World --shape square`
- Артефакт сборки: `dist/26430-Hello_World-1.0.1-<timestamp>.zab` (~62 КБ)
- Деплой: `zeus dev` (deviceSources 7995648, 7995649)

## `app.json` (существенные поля)

```json
{
  "app": { "appId": 26430, "appName": "Hello World", "appType": "app",
           "version": { "code": 1, "name": "1.0.1" },
           "icon": "icon.png" },
  "permissions": ["data:user.hd.heart_rate"],
  "targets": {
    "gt": {
      "module": { "page": { "pages": ["page/gt/home/index.page"] } },
      "platforms": [ { "st": "s" } ],
      "designWidth": 390
    }
  },
  "i18n": { "en-US": { "appName": "Hello World" } },
  "defaultLanguage": "en-US",
  "configVersion": "v3"
}
```

Правки относительно сгенерированного шаблона: `platforms` сведены к квадратному экрану
GTS 4 (`st: s`), `designWidth` = 390. `deviceSource` в `platforms` **не** добавлять —
это ломает сборку (см. [../concepts/device-source.md](../concepts/device-source.md)).

## Связанные страницы

- [../procedures/create-build.md](../procedures/create-build.md)
- [../procedures/simulator-dev.md](../procedures/simulator-dev.md)
- [../concepts/config-version.md](../concepts/config-version.md)
