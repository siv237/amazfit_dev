# Каталог вики

Вики по среде разработки Zepp OS для Amazfit GTS 4. Схема и конвенции — в
[../AGENTS.md](../AGENTS.md). Обновляется при каждом ingest.

## Meta

- [overview.md](overview.md) — обзор домена и итоговый статус среды
- [log.md](log.md) — хронология операций

## Sources (резюме raw-источников)

- [sources/promt-agent-zeppos-gts4-ubuntu.md](sources/promt-agent-zeppos-gts4-ubuntu.md) — промт-задание на развёртывание среды
- [sources/llm-wiki.md](sources/llm-wiki.md) — концепция LLM-вики
- [sources/khabarovsk-transport-api-research.md](sources/khabarovsk-transport-api-research.md) — исследование API транспорта Хабаровска

## Entities (объекты)

- [entities/amazfit-gts4.md](entities/amazfit-gts4.md) — устройство, параметры, deviceSource
- [entities/amazfit-bip6.md](entities/amazfit-bip6.md) — второе устройство (Zepp OS 5.0), параметры
- [entities/zeus-cli.md](entities/zeus-cli.md) — CLI-инструмент разработки
- [entities/zepp-os-simulator.md](entities/zepp-os-simulator.md) — симулятор и QEMU-образ
- [entities/nodejs.md](entities/nodejs.md) — Node.js / nvm
- [entities/vscode.md](entities/vscode.md) — VS Code и расширения
- [entities/hello-world-project.md](entities/hello-world-project.md) — тестовый проект
- [entities/bustime.md](entities/bustime.md) — агрегатор Bustime (реалтайм, socket.io)
- [entities/smarttransport-online.md](entities/smarttransport-online.md) — портал города (bus62)
- [entities/khmnic.md](entities/khmnic.md) — оператор РНИС Хабаровска
- [entities/khabarovsk-bus-app.md](entities/khabarovsk-bus-app.md) — приложение «Автобусы ХБР»

## Concepts (понятия)

- [concepts/zepp-os.md](concepts/zepp-os.md) — платформа Zepp OS
- [concepts/device-source.md](concepts/device-source.md) — deviceSource и выбор устройства
- [concepts/qr-install.md](concepts/qr-install.md) — установка через QR / облако
- [concepts/config-version.md](concepts/config-version.md) — configVersion в app.json
- [concepts/khabarovsk-transit.md](concepts/khabarovsk-transit.md) — транспорт Хабаровска: источники
- [concepts/yandex-rasp-api.md](concepts/yandex-rasp-api.md) — API Яндекс.Расписаний (статика)

## Procedures (процедуры)

- [procedures/setup-ubuntu.md](procedures/setup-ubuntu.md) — установка среды (шаги 1–5)
- [procedures/add-device-simulator.md](procedures/add-device-simulator.md) — добавление модели (Bip 6) в симулятор
- [procedures/create-build.md](procedures/create-build.md) — создание и сборка проекта
- [procedures/simulator-dev.md](procedures/simulator-dev.md) — запуск эмулятора и `zeus dev`
- [procedures/app-development.md](procedures/app-development.md) — приложения в `apps/`, скрипт деплоя, сеть
- [procedures/khabarovsk-transit-integration.md](procedures/khabarovsk-transit-integration.md) — план приложения «транспорт на остановке»
- [procedures/troubleshooting.md](procedures/troubleshooting.md) — типовые ошибки
