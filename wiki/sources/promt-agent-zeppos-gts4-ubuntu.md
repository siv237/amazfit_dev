---
type: source
tags: [zepp-os, gts4, setup]
status: partial
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# Источник: промт для ИИ-агента (настройка среды GTS 4 / Ubuntu)

`raw/promt-agent-zeppos-gts4-ubuntu.md` — задание развернуть среду разработки
мини-приложений и циферблатов Zepp OS для Amazfit GTS 4 на Ubuntu 24.04 + VS Code,
с финальной диагностикой. План из 8 шагов: система → Node → Zeus CLI → VS Code →
симулятор → тестовый проект → `zeus dev/preview` → диагностика.

## Что подтвердилось

- ОС, архитектура, набор пакетов, установка Node/CLI/VS Code/симулятора — воспроизводимо.
- Параметры GTS 4 совпали с кэшем устройств Zepp: `7995648`/`7995649`, `390*450`,
  `rAngle 86`, `previewSize 266*307`, `iconSize 124`.
- `zeus dev` подключается к симулятору и деплоит пакет (deviceSources 7995648, 7995649).
- Каталог `~/zepp-dev`, проект `hello-world`, `.zab` собирается.
- Часы по USB не подключаются — верно.

## Что оказалось неверным или неполным

1. **`zeus preview` требует авторизации.** QR строится на облачной ссылке после
   `api.uploadPackage`; без входа открывается страница логина Zepp. Wi-Fi часов не даёт
   локального канала установки.
2. **`deviceSource` в `app.json` ломает сборку** при `configVersion: v3` в zeus 1.9.3.
   Устройство выбирается при `zeus dev`/`zeus preview`.
3. **Нет app-шаблонов для APILevel 3.5** — `zeus create` падает; доступны 3.0 и 4.0.
4. **Симулятор 2.1.2**: штатный логин Huami не работает; `ELECTRON_RUN_AS_NODE` ломает
   запуск; QEMU требует `libaio`; нужна подсеть `192.168.166.0/24` для WS-порта 7833.
   Все обходы — в [../procedures/simulator-dev.md](../procedures/simulator-dev.md).
5. Расширение `Zepp.zeppos-dev-tools` снято с маркетплейса (FAIL).

## Итог

Среда развёрнута, тестовое приложение собрано и **запущено на эмуляторе GTS 4**.
Инструкция корректна в целом, но требует существенных дополнений по симулятору и по
установке на реальные часы.

## Связанные страницы

- [../overview.md](../overview.md)
- [../procedures/setup-ubuntu.md](../procedures/setup-ubuntu.md)
- [../procedures/troubleshooting.md](../procedures/troubleshooting.md)
