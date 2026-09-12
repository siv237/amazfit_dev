---
type: procedure
tags: [khabarovsk, transit, app, plan]
status: partial
updated: 2026-09-12
sources: [raw/khabarovsk-transport-api-research.md]
---

# Процедура: приложение «транспорт на остановке» (Хабаровск)

Цель — мини-приложение Zepp OS, которое показывает, какой транспорт и через сколько
минут придёт на выбранную остановку в Хабаровске. Каркас сети уже есть:
[app-development.md](app-development.md) (page + app-side + HTTP).

## Решение (работает)

Данные берём из **SmartTransport.online (bus62)** — у него нашёлся **токен по
умолчанию**, с которым JSON-POST API отвечает без капчи.

```
POST https://smarttransport.online/khabarovsk/php/apiRequest.php?<cmd>.php
Content-Type: application/json
{"t":"11111111-50b3-4fec-b922-8a50a1d38366","ct":26,"cd":"<cmd>.php","reg":27001,"w":-1,"data":{...}}
```

- `getStations.php` → 930 остановок с координатами (`id, name, description, lat, lng`).
- `getStationForecasts.php`, `data:{sid}` → прибытия (`routeShortName`, `routeNumber`,
  `whereGo`, `lastStation`, `arrivalTimeInSec`).
- CORS `*`, POST разрешён → работает из app-side (XHR).

Почему не Bustime: его realtime — WebSocket-only (POST polling → 502), из Zepp OS
недоступен. Яндекс.Расписания — только статика (fallback).

## Реализация

Приложение — `apps/khabarovsk-bus/` (см.
[../entities/khabarovsk-bus-app.md](../entities/khabarovsk-bus-app.md)). Версия 1:
ручной выбор остановки колесиком (`WIDGET_PICKER`) из списка `page/stops.js`, поверх
`app-side` с `getStationForecasts.php`. Проверено на эмуляторе GTS 4 — прибытия
отображаются и меняются при смене остановки.

## Дальше

- [ ] GPS-привязка: `@zos/sensor` `Geolocation` + `getStations.php` (координаты) →
      ближайшая остановка автоматически.
- [ ] Избранные остановки в настройках.
- [ ] Раскрыть полный список остановок (930) или поиск по названию.
- [ ] Fallback на статическое расписание (Яндекс.Расписания) при недоступности API.

## Связанные страницы

- [../concepts/khabarovsk-transit.md](../concepts/khabarovsk-transit.md)
- [../entities/bustime.md](../entities/bustime.md)
- [app-development.md](app-development.md)
- [../sources/khabarovsk-transport-api-research.md](../sources/khabarovsk-transport-api-research.md)
