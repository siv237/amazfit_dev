# Обзор: среда разработки Zepp OS для Amazfit GTS 4

Среда развёрнута на Ubuntu 24.04 (amd64) 2026-09-12. Разработка ведётся через
**Zeus CLI** в терминале VS Code. Приложение проверяется в **Zepp OS Simulator v2**
(настоящий QEMU-образ часов GTS 4 внутри), установка на реальные часы — через облако
Zepp + Bluetooth (Wi-Fi часов для этого не используется).

Итог: тестовый проект `hello-world` собран, **запущен на эмуляторе GTS 4**
(Zepp OS 3.5) и **установлен на реальные часы GTS 4** через `zeus preview` (QR) + Zepp App.

## Итоговый статус

| Компонент | Версия / путь | Статус | Комментарий |
|---|---|---|---|
| Ubuntu | 24.04.4 LTS (amd64) | OK | — |
| Node.js | v20.20.2 (nvm 0.40.1) | OK | в системе был v23 (не LTS) — переключились на 20 |
| npm | 10.8.2 | OK | идёт с Node 20 |
| Zeus CLI | 1.9.3 (zpm 3.4.2) | OK | `npm i -g @zeppos/zeus-cli` |
| VS Code | 1.120.0 | OK | уже был установлен |
| Расширение Zepp OS Dev Tools | — | FAIL | снято с маркетплейса (deprecated) |
| Zepp OS Simulator | 2.1.2 (`/opt/simulator/simulator`) | OK | GUI + QEMU-образ часов |
| Образ часов GTS 4 | v1.1.0, os 3.5, api 3.5 | OK | скачан из публичного CDN, без логина |
| `libaio.so.1` для QEMU | symlink → `libaio.so.1t64` | OK | иначе QEMU не стартует |
| QEMU usernet | `net=192.168.166.0/24` | OK | обязательный патч `start_qemu.sh` |
| Тестовый проект | `~/zepp-dev/hello-world` (appId 26430) | OK | создан `zeus create` |
| `zeus build` | — | OK | `dist/26430-Hello_World-1.0.1-*.zab` |
| `zeus dev` | — | OK | подключение к симулятору, deviceSource 7995648/7995649 |
| `zeus login` | аккаунт Zepp (`user.zepp.com`) | OK | вход выполнен (<account>, регион CN) |
| `zeus preview` (QR) | — | OK | после входа генерирует QR; регион облака cn3 |
| Wi-Fi-установка на часы | — | N/A | официального LAN-канала установки нет |
| Сеть до docs.zepp.com | HTTP/2 200 | OK | — |

## Главные находки (обходные пути)

Инструкция `raw/promt-agent-zeppos-gts4-ubuntu.md` в нескольких местах расходится с
фактическим поведением Zeus CLI 1.9.3 и симулятора 2.1.2. Ключевые обходы:

1. **Симулятор запускать без `ELECTRON_RUN_AS_NODE`.** При старте из VS Code наследуется
   `ELECTRON_RUN_AS_NODE=1`, из-за чего Electron-симулятор превращается в Node и сразу
   завершается. Нужно `env -u ELECTRON_RUN_AS_NODE -u NODE_OPTIONS /opt/simulator/simulator`.
2. **Образ часов качается без логина.** Прямой список:
   `https://upload-cdn.huami.com/zeppos/simulator/download/emulatorList.json`. Архив GTS 4
   кладётся в `~/.zepp/emulator_cache/<emulator-id>/` (`main.elf` + `norflash.bin`), запись
   добавляется в `~/.config/simulator/config.json` (`selectDeviceList`, `platform`).
3. **QEMU обязан работать в подсети `192.168.166.0/24`.** Прошивка поднимает WS-сервер на
   своём IP `192.168.166.188:7833`, а `start_qemu.sh` по умолчанию использует usernet
   `10.0.2.0/24` — тогда порт 7833 недоступен и приложение не запускается. Патч:
   `-nic user,id=usernet,net=192.168.166.0/24,host=192.168.166.1,hostfwd=tcp::7833-192.168.166.188:7833,model=lan9118`.
4. **QEMU нужен `libaio.so.1`.** В 24.04 пакет называется `libaio1t64`; нужен symlink
   `libaio.so.1 → libaio.so.1t64`.
5. **APILevel 3.5 не имеет app-шаблонов** — `zeus create` падает; используем 3.0.
6. **`deviceSource` в `app.json` ломает сборку** при `configVersion: v3`. Его нужно
   опускать; устройство выбирается при `zeus dev`.
7. **`zeus preview`/`zeus bridge` требуют аккаунт Zepp** (облако). Установка на реальные
   часы без аккаунта невозможна; Wi-Fi часов локального канала не даёт.

## Приложения в проекте

Исходники приложений лежат в `apps/` (в репозитории вики), деплой и сборка —
через `scripts/deploy.sh <app> [build|dev|preview|clean]`:

- `apps/hello-world` — тестовое приложение (без сети), запускалось на эмуляторе и часах.
- `apps/currency` — «Курс ЦБ РФ» (page + app-side + HTTP). Работает и в симуляторе, и
  **на реальных часах GTS 4**: показывает `USD 84.26 / EUR 97.87 / CNY 12.55` из API ЦБ.
- `apps/khabarovsk-bus` — «Автобусы ХБР»: прибытие транспорта на остановках Хабаровска,
  ручной выбор остановки колесиком. Работает на реальном API SmartTransport (bus62),
  проверено в симуляторе. См. [entities/khabarovsk-bus-app.md](entities/khabarovsk-bus-app.md).

Методика работы с сетью (app-side + `@zeppos/zml`, Fetch API, обязательное локальное
зеркало рантайма side-service для симулятора) описана в
[procedures/app-development.md](procedures/app-development.md).

## Следующая цель: транспорт на остановке (Хабаровск)

Проведено исследование источников. Итог: простого публичного API с прогнозом прибытия
нет; реальное время есть у Bustime (через socket.io) и SmartTransport.online/bus62
(JSON-POST с токеном-капчей). План и варианты —
[procedures/khabarovsk-transit-integration.md](procedures/khabarovsk-transit-integration.md),
детали — [concepts/khabarovsk-transit.md](concepts/khabarovsk-transit.md).

## Быстрые ссылки

- [index.md](index.md) — каталог страниц
- [procedures/simulator-dev.md](procedures/simulator-dev.md) — запуск эмулятора и `zeus dev`
- [procedures/create-build.md](procedures/create-build.md) — создать и собрать проект
- [procedures/troubleshooting.md](procedures/troubleshooting.md) — типовые ошибки
