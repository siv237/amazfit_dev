---
type: concept
tags: [api, yandex, schedule]
status: ok
updated: 2026-09-12
sources: [raw/khabarovsk-transport-api-research.md]
---

# API Яндекс.Расписаний v3.0

Открытый API **статических расписаний** (не realtime). Для городского транспорта
Хабаровска подходит лишь частично (ж/д, междугородние автобусы).

- Документация/кабинет: `https://yandex.ru/dev/rasp/raspapi/` (редирект, 2026-09-12)
- Базовый URL: `https://api.rasp.yandex.net/v3.0/`
- Аутентификация: **API-ключ** в параметре `apikey` (бесплатный, Кабинет разработчика)
- Методы: `/search/`, `/schedule/`, `/nearest_stations/`, `/stations_list/`, `/carrier/`

Пример:

```
GET https://api.rasp.yandex.net/v3.0/schedule/?apikey=KEY&station=<id>&transport_types=bus&format=json
```

Лимит бесплатного тарифа — ориентировочно ~500 запросов/сутки (уточнять в кабинете).

## Почему не основной источник

Реального времени (прогноза прибытия) здесь нет — только расписание. Для основного
сценария (какой автобус придёт и через сколько минут) нужен realtime, см.
[../concepts/khabarovsk-transit.md](../concepts/khabarovsk-transit.md).
