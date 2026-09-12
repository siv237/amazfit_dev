---
type: entity
tags: [gts4, device, hardware]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# Amazfit GTS 4

Целевое устройство разработки. Данные подтверждены кэшем Zepp
`~/.zepp/.zeus_devices` и публичным `emulatorList.json`.

| Параметр | Значение |
|---|---|
| Модель | Amazfit GTS 4 |
| deviceSource (Lille) | **7995648** |
| deviceSource (Lillew) | **7995649** |
| Внутренний код | `Lille` / `Lillew` |
| Платформа | Zepp OS 3.5, `apiLevel` 3.5 |
| Экран | квадратный, 390×450 |
| Форма (`st`) | `s` (square) |
| Превью симулятора | 266×307 |
| `rAngle` | 86 |
| Размер иконки для dev-сборки | 124 |
| `designWidth` | 390 |

## Подключение к ПК

Часы **не** подключаются по USB (ни ADB, ни udev). Установка мини-приложений — через
облако Zepp и Bluetooth телефона. Wi-Fi на GTS 4 используется приложениями, но не даёт
канала для установки dev-пакета.

Проверка в сети (2026-09-12): часы найдены по OUI как `<watch-ip>`
(MAC `<watch-mac>`, Anhui Huami Information Technology). Открытых TCP-портов нет
(полный скан 1–65535 пуст), локального сервиса установки нет.

## Связанные страницы

- [../concepts/device-source.md](../concepts/device-source.md)
- [../concepts/qr-install.md](../concepts/qr-install.md)
- [../entities/zepp-os-simulator.md](../entities/zepp-os-simulator.md)
