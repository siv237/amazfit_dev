# Amazfit Bip 6

---
type: entity
tags: [bip6, device, hardware]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

Второе целевое устройство (после [GTS 4](amazfit-gts4.md)). Данные подтверждены
публичным `emulatorList.json` и кэшем Zepp `~/.zepp/.zeus_devices`.

| Параметр | Значение |
|---|---|
| Модель | Amazfit Bip 6 |
| deviceSource | **9765120** (`Pamir`), **9765121** (`PamirW`), **10158337** (`PamirW64`) |
| Платформа | образ v1.1.0: **Zepp OS 5.0**, `api_level` 4.2, `support` 2.0.0 |
| Старый образ | v1.0.0: Zepp OS 4.5, `api_level` 4.0 |
| Экран | квадратный, **390×450** (как GTS 4) |
| Форма (`st`) | `s` (square) |
| Превью симулятора | 266×307 |
| `rAngle` | 86 |
| Размер иконки для dev-сборки | 124 |
| `designWidth` | 390 |
| ID образа симулятора | `4ae8ec66a7e2d342faf040652f4f41ff` |
| Файл образа | `.../20251027/bip6_os50_v110.zip` (~152 МБ) |

Геометрия экрана совпадает с GTS 4, поэтому вёрстка приложений переносится без
изменений (тот же `st:"s"`, `dw:390`, скругление 86).

## Сеть в эмуляторе

Прошивка Bip 6 **жёстко прописывает** сеть QEMU-slirp `10.0.2.15` (шлюз `10.0.2.2`),
в отличие от GTS 4 (`192.168.166.188`). Поэтому `start_qemu.sh` определяет подсеть по
содержимому `main.elf` (см. [процедуру добавления устройства](../procedures/add-device-simulator.md)).
Признаки: QEMU получает `net=10.0.2.0/24` и `hostfwd=tcp::7833-10.0.2.15:7833`.

## Связанные страницы

- [../procedures/add-device-simulator.md](../procedures/add-device-simulator.md)
- [../concepts/device-source.md](../concepts/device-source.md)
- [khabarovsk-bus-app.md](khabarovsk-bus-app.md)
