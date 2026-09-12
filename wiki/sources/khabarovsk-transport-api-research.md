---
type: source
tags: [khabarovsk, transit, api, research]
status: ok
updated: 2026-09-12
sources: [raw/khabarovsk-transport-api-research.md]
---

# Источник: исследование API транспорта Хабаровска

`raw/khabarovsk-transport-api-research.md` — результат поисковой ИИ по запросу
[raw/research-khabarovsk-transit-prompt.md](../../raw/research-khabarovsk-transit-prompt.md).
Описаны источники онлайн-данных о прибытии транспорта на остановки Хабаровска.

## Ключевые тезисы источника

- Официального публичного API / GTFS(-RT) у первоисточников (ХМНИЦ, РНИС) **нет**.
- Яндекс.Карты и 2ГИС показывают реальное время, но публичного realtime-API для
  прогноза прибытия у них нет (Masstransit закрыт; у 2ГИС только маршрутизация).
- Агрегаторы (Bustime, SmartTransport.online, расписаниеавтобуса.рф) реальное время
  отдают, питаясь от городской РНИС.
- Рекомендация источника: Bustime как основной кандидат, SmartTransport — fallback.

## Что подтвердил я (проверка 2026-09-12, через прокси 17277)

- ✅ `https://ru.busti.me/` → 200; город **`/habarovsk/`**; маршруты вида
  `/habarovsk/bus-10/`; остановки вида `/habarovsk/stop/<slug>/`.
- ✅ Остановка «Автовокзал»: `id 34271` (направление «Станционная») и `id 34241`
  (направление «Пассажирское депо»), координаты 48.50 / 135.06 — данные в HTML
  страницы остановки (`stop_selected`, `astops`, JSON-LD BusStop).
- ⚠️ **Поправка к источнику:** простого REST `GET /api/stop/<id>/` у Bustime нет.
  Реалтайм — **socket.io** (Engine.IO v4): handshake
  `https://ru.busti.me/socket.io/?EIO=4&transport=polling` возвращает
  `0{"sid":...,"upgrades":["websocket"],"pingInterval":25000,...}`. В JS-бандле
  (`sel.bustm.net/static/js/bundle-built-183.js`) — RPC-методы `rpc_stop_ids`,
  `rpc_busstop_info`, `rpc_bdata`, `rpc_vehicle_info`. `/ajax/stops_by_gps/` без
  верных параметров отдаёт `[]`.
- ✅ `https://smarttransport.online/khabarovsk/` → 200; это движок **bus62**
  (`probki.bus62.ru`, `maps.bus62.ru`). Бэкенд: `php/apiRequest.php`.
- ✅ Формат запроса SmartTransport: `POST https://smarttransport.online/khabarovsk/php/apiRequest.php?<cmd>.php`,
  тело JSON `{t, ct:26, cd:"<cmd>.php", reg:27001, w:-1, data:{wuid}}`.
  Команды: `getRegions`, `getStations`, `getStationForecasts`, `getStationRoutes`,
  `getStationSchedules`, `getRoutes`, `getRouteById`, `getVehicleForecasts`,
  `getVehiclesAnimation`, `serviceRequest`, `precaptchaRequest` и др.
  Регион Хабаровск: `id 27001`, центр 48.480229 / 135.071917.
- ⚠️ **Поправка к источнику:** SmartTransport требует токен `t` (форма с reCAPTCHA,
  `publicKey` в `localConfig.js`) → «просто GET» без токена не работает; API
  отвечает `{"r":"fail","reason":"not enough params","message":"Отсутствует t"}`.
- ✅ `/ajax/stops_by_gps/` и `on_busstops/` (302) не дают прогноза напрямую.

## Рабочий API найден (проверено 2026-09-12)

В JS-бандле SmartTransport зашит **токен по умолчанию**
`11111111-50b3-4fec-b922-8a50a1d38366`; с ним API работает по Хабаровску без капчи:

```
POST https://smarttransport.online/khabarovsk/php/apiRequest.php?<cmd>.php
Content-Type: application/json
{"t":"11111111-50b3-4fec-b922-8a50a1d38366","ct":26,"cd":"<cmd>.php","reg":27001,"w":-1,"data":{...}}
```

Проверенные команды:
- `getStations.php` → 930 остановок с `id, name, description, lat, lng` (159 КБ). Пример:
  «Пл. Ленина» — `id 67`, 48.481573 / 135.072427.
- `getStationForecasts.php`, `data:{sid:<станция>}` → массив прибытий:
  ```json
  {"stationId":1,"routeShortName":"Тб-2","routeNumber":"2","routeTypeId":2,
   "whereGo":"Аэропорт","lastStation":"Степная","arrivalTimeInSec":516}
  ```
- `getRoutes.php` → маршруты Хабаровска.

CORS открыт (`access-control-allow-origin: *`, POST/OPTIONS разрешены) — пригодно для
app-side. Bustime при этом отпадает: его realtime — WebSocket-only (POST polling
отдаёт 502), из Zepp OS недоступен.

## Вывод

Рабочий путь: **SmartTransport (bus62) JSON-POST API с токеном по умолчанию**.
Остановки приходят с координатами → можно делать привязку по GPS. Bustime — не
подходит (WebSocket). Яндекс.Расписания — только статика.

## Связанные страницы

- [../concepts/khabarovsk-transit.md](../concepts/khabarovsk-transit.md)
- [../entities/bustime.md](../entities/bustime.md)
- [../entities/smarttransport-online.md](../entities/smarttransport-online.md)
- [../procedures/khabarovsk-transit-integration.md](../procedures/khabarovsk-transit-integration.md)
