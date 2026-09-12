---
type: entity
tags: [khabarovsk, transit, api, bustime]
status: partial
updated: 2026-09-12
sources: [raw/khabarovsk-transport-api-research.md]
---

# Bustime (busti.me)

Агрегатор общественного транспорта с **открытым исходным кодом** (MIT):
`https://github.com/bustime-org/bustime`. Реальное время по GPS + прогноз прибытия.

- Русская версия: `https://ru.busti.me/`
- Хабаровск: `https://ru.busti.me/habarovsk/` (проверено 2026-09-12, HTTP 200)
- Маршруты: `/habarovsk/bus-10/`, `/habarovsk/bus-1s/`, …
- Остановки: `/habarovsk/stop/<slug>/` (например `/habarovsk/stop/avtovokzal/`)
- Статика/скрипты: `sel.bustm.net` (SystemJS, бандл `bundle-built-183.js`)

## Данные остановки

Числовой ID и координаты встроены в HTML страницы остановки:

```js
var stop_selected = { id: 34271, name: "Автовокзал", slug: "avtovokzal",
                      moveto: "Станционная", x: 135.0665506, y: 48.5022165 }
```

«Автовокзал» представлен двумя остановками: `34271` и `34241` (разные направления).

## Реалтайм — socket.io (важно)

Простого REST `GET /api/stop/<id>/` **нет**. Реалтайм идёт через **socket.io
(Engine.IO v4)**:

```
GET https://ru.busti.me/socket.io/?EIO=4&transport=polling
→ 0{"sid":"...","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":60000}
```

В бандле используются RPC-методы: `rpc_stop_ids`, `rpc_busstop_info`, `rpc_bdata`,
`rpc_vehicle_info`, `rpc_gps_send`. Также есть HTTP-эндпоинты `/ajax/stops_by_gps/`,
`/ajax/route_lines_calc/`, `/on_busstops/` (без прогноза).

## Пригодность для Zepp OS

- ✅ HTTPS, JSON, код открыт, Хабаровск подтверждён.
- ⚠️ Для прогноза нужен socket.io-клиент (engine.io polling через XHR в app-side) —
  заметно сложнее, чем один GET.
- ⚠️ ToS на данные — сервисные; при публикации приложения согласовать
  (`support@busti.me`).

## Связанные страницы

- [../concepts/khabarovsk-transit.md](../concepts/khabarovsk-transit.md)
- [../sources/khabarovsk-transport-api-research.md](../sources/khabarovsk-transport-api-research.md)
