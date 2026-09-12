---
type: entity
tags: [simulator, qemu, tool]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# Zepp OS Simulator

Настольный симулятор Zepp OS. Внутри запускает **настоящий образ часов под QEMU**, а не
эмуляцию в браузере.

- Версия: **2.1.2**
- Бинарь: `/opt/simulator/simulator` (Electron)
- Ресурсы: `/opt/simulator/resources/` (`app.asar`, `firmware/` с `start_qemu.sh` и
  `qemu_linux/qemu-system-arm`)
- Конфиг: `~/.config/simulator/config.json`
- Кэш образов: `~/.zepp/emulator_cache/<emulator-id>/`
- Иде-сервер (для `zeus`): порт **7650**; websocket до QEMU: порт **7833**
- CDP-порт Electron — динамический, `127.0.0.1:<port>` (для автоматизации GUI)

## Запуск

```
env -u ELECTRON_RUN_AS_NODE -u NODE_OPTIONS /opt/simulator/simulator
```

`ELECTRON_RUN_AS_NODE` наследуется от VS Code и заставляет Electron работать как Node —
симулятор молча завершается. Обязательно снимать эту переменную.

## Образ часов GTS 4

- Список образов: `https://upload-cdn.huami.com/zeppos/simulator/download/emulatorList.json`
- GTS 4 v1.1.0: id `9910c32ad75b6de37632c333491695d8`, os 3.5, api 3.5,
  `support 1.1.7`, файл `.../20240905/gts4_os35_v110.zip` (~158 МБ).
- Архив содержит `main.elf` + `norflash.bin`; раскладывается в
  `~/.zepp/emulator_cache/<id>/`.

## Ключевые грабли

1. `ELECTRON_RUN_AS_NODE` (см. выше).
2. QEMU требует `libaio.so.1` (в 24.04 — symlink на `libaio.so.1t64`).
3. Прошивка поднимает WS на `192.168.166.188:7833`, поэтому QEMU-usernet должен быть в
   подсети `192.168.166.0/24` — иначе `zeus dev` не может достучаться до устройства.
4. Штатный логин симулятора (окно Huami) в v2.1.2 не работает (старый встроенный
   Chromium), но образ и запуск можно поднять без него.

## Связанные страницы

- [../procedures/simulator-dev.md](../procedures/simulator-dev.md)
- [../procedures/troubleshooting.md](../procedures/troubleshooting.md)
- [../entities/amazfit-gts4.md](../entities/amazfit-gts4.md)
