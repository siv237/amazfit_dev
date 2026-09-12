---
type: entity
tags: [khabarovsk, transit, api, bus62]
status: partial
updated: 2026-09-12
sources: [raw/khabarovsk-transport-api-research.md]
---

# SmartTransport.online (движок bus62)

Публичный «Транспортный портал г. Хабаровск»:
`https://smarttransport.online/khabarovsk/` (проверено 2026-09-12, HTTP 200).
Похоже, публичный фасад городской системы (РНИС/ХМНИЦ). Работает на движке **bus62**
(связанные домены: `probki.bus62.ru`, `maps.bus62.ru`, мобильное приложение
`ru.bus62.SmartTransport`).

## API

- Backend (из `localConfig.js`): `php/apiRequest.php`
- Вызов: `POST https://smarttransport.online/khabarovsk/php/apiRequest.php?<cmd>.php`
- Тело (JSON):
  ```json
  {"t":"<token>","ct":26,"cd":"<cmd>.php","reg":27001,"w":-1,"data":{"wuid":""}}
  ```
- Регион Хабаровск: `reg 27001`; КЛАДР `2700000100000`; центр 48.480229, 135.071917.

## Команды (`cd`)

`getRegions`, `getStations`, `getStationForecasts`, `getStationRoutes`,
`getStationSchedules`, `getRoutes`, `getRouteById`, `getVehicleForecasts`,
`getVehiclesAnimation`, `getSubrouteNodes`, `buildRoute`, `serviceRequest`,
`precaptchaRequest` и др. (извлечено из `index.*.js`).

`getStationForecasts.php` — прогноз прибытия; в данных есть `arrivalTimeInSec`.

## Токен: рабочий по умолчанию

В JS-бандле сайта зашит токен по умолчанию, с которым API работает **без капчи**:

```
t = 11111111-50b3-4fec-b922-8a50a1d38366
```

Без токена ответ: `{"r":"fail","reason":"not enough params","message":"Отсутствует t"}`;
поддельный токен → `Некорректный токен`. С дефолтным токеном (проверено 2026-09-12):

- `getStations.php` → **930 остановок** Хабаровска с `id, name, description, lat, lng`.
- `getStationForecasts.php`, `data:{sid}` → прибытия
  (`routeShortName`, `routeNumber`, `routeTypeId`, `whereGo`, `lastStation`,
  `arrivalTimeInSec`).
- `getRoutes.php` → маршруты.
- CORS: `access-control-allow-origin: *`, POST/OPTIONS разрешены → подходит для app-side.

Токен завязан на регион (`reg`); для Хабаровска `reg=27001`. Токен может быть
отозван/изменён при обновлении сайта — держать в конфиге.

## Связанные страницы

- [../concepts/khabarovsk-transit.md](../concepts/khabarovsk-transit.md)
- [../sources/khabarovsk-transport-api-research.md](../sources/khabarovsk-transport-api-research.md)
