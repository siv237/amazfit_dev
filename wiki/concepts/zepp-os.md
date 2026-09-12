---
type: concept
tags: [zepp-os, platform]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# Zepp OS

ОС и платформа мини-приложений для носимых устройств Amazfit/Zepp. Приложения
(и циферблаты) пишутся на JavaScript, собираются в пакет `.zab` и запускаются на
устройстве в песочнице Zepp OS.

## Версии и уровни

- **Zepp OS 3.5** — версия ОС целевых часов GTS 4.
- **API_LEVEL** — уровень API устройства. У GTS 4 — `3.5` (в кэше устройств).
- При создании проекта используется флаг `--APILevel` (доступны 1.0, 2.0, 3.0, 3.5, 4.0).
  Сборка с APILevel 3.0 совместима с GTS 4.

## Типы проектов

- `APP` — мини-приложение (в т.ч. шаблоны hello-world, fetch-api и т.п.).
- `WATCHFACE` — циферблат.
- `workout-extension` — расширение тренировок (для APILevel 3.5 доступен только он).

## Жизненный цикл разработки

`zeus create` → `zeus build` → `zeus dev` (симулятор) / `zeus preview` (QR на часы).

## Связанные страницы

- [../entities/amazfit-gts4.md](../entities/amazfit-gts4.md)
- [../concepts/device-source.md](../concepts/device-source.md)
- [../concepts/config-version.md](../concepts/config-version.md)
