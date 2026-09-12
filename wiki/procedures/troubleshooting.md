---
type: procedure
tags: [troubleshooting, errors]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# Процедура: типовые ошибки

## Симулятор сразу закрывается, без вывода

**Причина:** унаследован `ELECTRON_RUN_AS_NODE=1` (из VS Code) — Electron работает как
Node.
**Решение:** `env -u ELECTRON_RUN_AS_NODE -u NODE_OPTIONS /opt/simulator/simulator`.

## `./qemu-system-arm: error while loading shared libraries: libaio.so.1`

**Причина:** в Ubuntu 24.04 пакет называется `libaio1t64`, библиотека — `libaio.so.1t64`.
**Решение:**
```
sudo apt-get install -y libaio1t64
sudo ln -sf /lib/x86_64-linux-gnu/libaio.so.1t64 /usr/lib/x86_64-linux-gnu/libaio.so.1
sudo ldconfig
```

## Приложение не открывается на эмуляторе, порт 7833 не отвечает

**Причина:** прошивка слушает `192.168.166.188:7833`, а QEMU-usernet по умолчанию
`10.0.2.0/24` → hostfwd не доходит до гостя. В serial-логе: `Get IP: 192.168.166.188`,
`Starting WS server on http://192.168.166.188:7833`.
**Решение:** патч `start_qemu.sh` (см. [simulator-dev.md](simulator-dev.md), шаг 4).
Проверка: `curl -o /dev/null -w '%{http_code}' http://127.0.0.1:7833/` → `200`.

## Симулятор просит логин Huami и не даёт скачать образ часов

**Причина:** встроенная страница логина в симуляторе 2.1.2 не работает (старый
Chromium, ошибка JS); для установки образа вход не нужен.
**Решение:** скачать образ вручную из `emulatorList.json` и прописать в
`config.json` (см. [simulator-dev.md](simulator-dev.md), шаги 1–3).

## `zeus create`: «Choose a app template» зависает/падает

**Причина:** для `--APILevel 3.5` нет app-шаблонов.
**Решение:** использовать `--APILevel 3.0` (совместимо с GTS 4).

## `zeus build`: `The icon in app.json is empty or the image does not exist`

**Причина:** в `platforms` задан `deviceSource` (или `name`) при `configVersion v3`.
**Решение:** убрать `deviceSource`/`name` из `platforms`, оставить только `st`.

## `zeus preview` открывает браузер с логином / требует пароль

**Причина:** `preview` загружает пакет в облако Zepp (`api.uploadPackage`), при 401
вызывает `zeus login`. Это ожидаемое поведение, а не ошибка среды.
**Решение:** войти тем же аккаунтом Zepp, что в телефоне (`zeus login`,
`user.zepp.com`). Без аккаунта установка на часы невозможна.

## `C:shake timeout` / side-service не привязывается (в т.ч. на Bip 6)

**Причина №1 (проверено): неверный рабочий каталог симулятора.** Симулятор
нужно запускать с cwd `/opt/simulator`. Если запустить из другого каталога
(например, из корня проекта), QEMU поднимается и `7833` отдаёт `200`, но
устройство так и не получает `shake success` — в `/opt/simulator/sim-debug.log`
только `shake send`. Отсюда `C:shake timeout`. Запускать через
`scripts/run-simulator.sh`. Проверка:
`grep -a "shake success" /opt/simulator/sim-debug.log | tail -1`.

**Причина №2:** зеркало рантайма side-service не поднято/неполное
(`net::ERR_HTTP2_PING_FAILED`, обрыв загрузки) — см. `app-development.md`.

**Причина №3:** side-service «залипает» после серии пересборок/перезапусков или
смены активной модели; накапливаются окна `app-side-service`. Симптомы:
`sideService launch error <appId>`, `worker.service.localStorage ... timeout`.
Решение — полный чистый перезапуск:
```
pkill -9 -x qemu-system-arm
pkill -9 -x simulator
rm -rf ~/.config/simulator/apps/* \
       ~/.config/simulator/'Code Cache' ~/.config/simulator/Cache \
       ~/.config/simulator/GPUCache ~/.config/simulator/Singleton*
scripts/run-simulator.sh   # затем Emulator и ОДИН деплой
```
Дать привязке до ~70–120 с после деплоя, не перезапускать деплой в это время.
`curl 127.0.0.1:7833` → `200` подтверждает только транспорт, не привязку.

Замечание: смена модели в `config.json` (`platform`) без чистого перезапуска тоже
приводит к этому состоянию.

## `нет` вместо маршрута в «Автобусах ХБР»

Это не сбой сети. `нет` = `GET_NEARBY` успешно отработал, но API вернул 0 прибытий
(например, ночью рейсов нет). При неработающем side-service было бы `…`, а в статусе
`обновлено 0 с назад`. Проверить API можно запросом `getStationForecasts.php`
по `sid` выбранной остановки.

## `zeus status` показывает `simulator connect status: disconnected`

**Причина:** часы-эмулятор (QEMU) ещё не запущены или порт 7833 недоступен.
**Решение:** запустить эмулятор кнопкой **Emulator** и убедиться, что порт 7833
отдаёт `200`; в логах — `Client:open`.

## Связанные страницы

- [simulator-dev.md](simulator-dev.md)
- [create-build.md](create-build.md)
- [../entities/zeus-cli.md](../entities/zeus-cli.md)
