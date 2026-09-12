---
type: procedure
tags: [dev, apps, deploy, fetch]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# Процедура: разработка и деплой приложений

## Структура проекта

Исходники приложений хранятся в репозитории вики, **разделённые по моделям**
(`apps/<model>/<app>/`):

```
apps/
  gts4/                     Amazfit GTS 4 (Zepp OS 3.5)
    hello-world/            тестовое приложение (без сети)
    currency/               курс валют ЦБ РФ (page + app-side + fetch)
    khabarovsk-bus/         «Автобусы ХБР» (транспорт Хабаровска)
  bip6/                     Amazfit Bip 6 (Zepp OS 5.0)
    khabarovsk-bus/         порт «Автобусов ХБР» (та же вёрстка, 390×450)
scripts/
  deploy.sh                     синхронизация apps/<model>/<app> → ~/zepp-dev/<app> и zeus
  setup-framework-mirror.sh     локальное зеркало рантайма side-service для симулятора
```

`node_modules/` и `dist/` в репозиторий не попадают (см. `.gitignore`).

## Деплой

```
scripts/deploy.sh gts4/currency build     # синхронизировать и собрать
scripts/deploy.sh bip6/khabarovsk-bus dev # собрать и залить в симулятор (watch)
scripts/deploy.sh gts4/currency preview   # QR для установки на реальные часы
scripts/deploy.sh gts4/currency clean     # удалить рабочую копию
```

Можно указывать и просто `<app>` (`deploy.sh currency build`), если имя уникально
среди моделей. Рабочая копия — `~/zepp-dev/<app>` (basename, переопределяется
`ZEPP_WORKDIR`).

Скрипт использует `rsync` (исключая `node_modules`, `dist`), при необходимости
выполняет `npm install`, переключается на Node 20 через nvm и запускает `zeus`.

## Сеть в Zepp OS

Сеть доступна **только в app-side** (Side Service, выполняется на телефоне), не на
стороне экрана. Архитектура:

- `page/index.js` — UI часов, вызывает `this.request({ method })` (из `@zeppos/zml/base-page`);
- `app-side/index.js` — `BaseSideService`, обрабатывает `onRequest` и делает HTTP;
- `@zeppos/zml` — связь page ↔ app-side; добавляется в `package.json`.

Официальный шаблон — `zeus create <name> --APILevel 3.0 --template "Fetch Api"`.

### Fetch API (Side Service)

По документации (Side Service API → Fetch API) запрос делается **строкой URL**
(стандартный `fetch`, как в MDN): `await fetch(url)` — это GET. Ответ читается
`response.text()`.

Практический приём (устойчивость к среде): в `app-side` перебирать варианты —
`fetch(url)` (строка) → `fetch({ url, method: "GET" })` (форма из шаблона zeus) →
`XMLHttpRequest`. В симуляторе рабочим оказался `XMLHttpRequest`; в логе видно
`httpGet ok via xhr len=6974`.

### Версия `@zeppos/zml`

Шаблон zeus фиксирует `@zeppos/zml` ^0.0.9, но лучше ставить актуальную (^0.0.43):
`npm view @zeppos/zml version`.

### Критично: рантайм side-service для симулятора (локальное зеркало)

Симулятор грузит окружение app-side со страницы
`https://zepp-os.zepp.com/frameworks/<ver>/side-service.html` + `mobile-main-service.js`
(~448 КБ). **В этой сети загрузка с zepp-os.zepp.com обрывается на ~16 КБ**, рантайм
получается неполным, из-за чего рукопожатие page↔app-side не проходит: на часах
`C:shake timeout`, в консоли `net::ERR_HTTP2_PING_FAILED`. Это НЕ ошибка кода и НЕ
проблема QEMU/сети эмулятора.

Решение — подсунуть симулятору полный локальный рантайм:

```
scripts/setup-framework-mirror.sh --serve   # качает через прокси 127.0.0.1:17277
                                            # в /tmp/zepp-fw и пишет ~/.zepp/.simulator.config.js
```

Скрипт выставляет `simulator["side-service"].url` на
`http://127.0.0.1:8099/<ver>/side-service.html`. После этого app-side получает
`AppSideService`/`messaging`, handshake проходит, и запросы уходят в сеть.

Проверенный результат: приложение «Курс ЦБ РФ» на GTS 4 в симуляторе показывает
`2026-09-12 / USD 84.26 / EUR 97.87 / CNY 12.55`.

## Проверка на реальных часах

1. `scripts/deploy.sh currency preview` (нужен выполненный `zeus login`).
2. Отсканировать QR в Zepp App (Профиль → Настройки → Режим разработчика → сканер).
3. Приложение установится на часы по Bluetooth.

## Связанные страницы

- [create-build.md](create-build.md)
- [../concepts/qr-install.md](../concepts/qr-install.md)
- [../concepts/zepp-os.md](../concepts/zepp-os.md)
