---
type: procedure
tags: [project, build, zeus]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# Процедура: создание и сборка проекта

## Создание

`zeus create` для `--APILevel 3.5` падает: у 3.5 нет app-шаблонов. Используем 3.0.

```
cd ~/zepp-dev
zeus create hello-world --APILevel 3.0 --appType APP --template Hello_World --shape square
```

`zeus create` — интерактивный; для неинтерактивного запуска передаются флаги
`--APILevel`, `--appType`, `--template` (`Hello_World`), `--shape`. При необходимости
ввод можно подать через pty.

## Правка `app.json`

- `configVersion` уже `"v3"`.
- `targets.<target>.platforms` — оставить только форму экрана GTS 4:
  `[ { "st": "s" } ]`.
- `designWidth` — `390`.
- **Не добавлять** `deviceSource`/`name` в `platforms` (ломает сборку).
- Двигать файлы раскладок `assets/gt.r` / `assets/gt.s` не нужно: target-ключ `gt`
  сохраняется.

## Сборка

```
cd ~/zepp-dev/hello-world
zeus build
ls -lh dist/*.zab
```

Результат: `dist/26430-Hello_World-1.0.1-<timestamp>.zab` (~62 КБ).

## Важно

`zeus build` очищает/перезаписывает `dist/`; артефакт `zeus dev`/прерванного
`zeus preview` может исчезнуть — пересобрать заново.

## Связанные страницы

- [../concepts/device-source.md](../concepts/device-source.md)
- [../entities/hello-world-project.md](../entities/hello-world-project.md)
- [simulator-dev.md](simulator-dev.md)
