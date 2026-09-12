---
type: concept
tags: [khabarovsk, transit, data-sources]
status: ok
updated: 2026-09-12
sources: [raw/khabarovsk-transport-api-research.md]
---

# Транспорт Хабаровска: где брать данные

Онлайн-данные о движении городского транспорта Хабаровска существуют, но открытого
API «из первых рук» нет — все публичные сервисы идут через посредников.

## Цепочка данных

```
ГЛОНАСС-трекеры перевозчиков
        ↓
РНИС Хабаровского края / МБУ «ХМНИЦ» (оператор, nic27.ru)
        ↓ (закрытые каналы)
 ┌──────────────┬───────────────────────┬────────────────────┐
 Яндекс.Карты   2ГИС                    Агрегаторы (Bustime,
 (Masstransit   (только маршрутизация)  SmartTransport.online/bus62)
  закрыт)
```

## Участники

- **МБУ «ХМНИЦ»** (`nic27.ru`) — муниципальный оператор РНИС. Публичного API нет,
  витрины реальных данных на сайте нет; реализация отдана на аутсорс.
- **РНИС Хабаровского края** — технический шлюз для перевозчиков, непубличный.
- **Bustime** (`ru.busti.me`, г. Хабаровск `/habarovsk/`) — агрегатор с открытым
  кодом (MIT), реалтайм через socket.io. См. [../entities/bustime.md](../entities/bustime.md).
- **SmartTransport.online / bus62** (`smarttransport.online/khabarovsk/`) — публичный
  портал города на движке bus62, JSON-POST API с токеном. См.
  [../entities/smarttransport-online.md](../entities/smarttransport-online.md).
- **Яндекс** — Masstransit закрыт; открыт только API Расписаний (статика). См.
  [yandex-rasp-api.md](yandex-rasp-api.md).
- **2ГИС** — realtime-прогноза по остановке нет.

## Идентификаторы Хабаровска

| Что | Значение |
|---|---|
| Город Bustime | `/habarovsk/` |
| Остановка «Автовокзал» (Bustime) | `34271` (на «Станционную»), `34241` (на «Пассажирское депо») |
| Регион SmartTransport/bus62 | `reg 27001`, КЛАДР `2700000100000` |
| Центр Хабаровска (для гео-API) | 48.480229, 135.071917 |

## Рабочий источник (найдено)

Реально использовать **SmartTransport.online (bus62)**:
- токен по умолчанию `11111111-50b3-4fec-b922-8a50a1d38366`, регион `27001`;
- `getStations.php` → 930 остановок с координатами (для GPS-привязки);
- `getStationForecasts.php` `{sid}` → прибытия в реальном времени;
- CORS открыт, POST разрешён → работает из app-side.

Bustime не подходит: realtime только через WebSocket (POST polling → 502).
Подробности и идентификаторы — [../entities/smarttransport-online.md](../entities/smarttransport-online.md).

## Вывод для нашего приложения

Делаем привязку по GPS: часы берут координаты (`@zos/sensor` Geolocation), ищут
ближайшую остановку в списке `getStations` и запрашивают `getStationForecasts`.
План — [../procedures/khabarovsk-transit-integration.md](../procedures/khabarovsk-transit-integration.md).
