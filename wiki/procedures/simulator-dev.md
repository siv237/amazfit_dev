---
type: procedure
tags: [simulator, qemu, zeus-dev, gts4]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# Процедура: запуск эмулятора GTS 4 и `zeus dev`

Пошагово воспроизводит рабочий запуск приложения на эмуляторе **без логина**.
Все шаги проверены 2026-09-12.

## 0. Предусловия

- Установлен симулятор 2.1.2 и `libaio1t64` + symlink `libaio.so.1` (см.
  [setup-ubuntu.md](setup-ubuntu.md)).
- Node 20 активен (`nvm use 20; hash -r`).

## 1. Скачать образ часов GTS 4 (публично, без аккаунта)

```
curl -s https://upload-cdn.huami.com/zeppos/simulator/download/emulatorList.json -o /tmp/emulatorList.json
```

В списке у записи `modelName == "GTS 4"` (device `[7995648, 7995649]`) берём релиз
`code == "1.1.0"`: id `9910c32ad75b6de37632c333491695d8`,
`filePath` = `https://upload-cdn.zepp.com/zepp-applet-and-wechat-applet/20240905/gts4_os35_v110.zip`.

## 2. Разложить образ как это делает симулятор

Приложение качает ZIP в `~/.zepp/emulator_cache/<id>.zip`, распаковывает, переименовывает
верхнюю папку в `<id>`. Повторяем вручную:

```
cd ~/.zepp/emulator_cache
curl -sL -o 9910c32ad75b6de37632c333491695d8.zip \
  "https://upload-cdn.zepp.com/zepp-applet-and-wechat-applet/20240905/gts4_os35_v110.zip"
python3 - <<'PY'
import zipfile, os
ZID="9910c32ad75b6de37632c333491695d8"
z=zipfile.ZipFile(ZID+".zip"); z.extractall(".")
top=[n.split('/')[0] for n in z.namelist() if '/' in n][0]
if os.path.exists(ZID): import shutil; shutil.rmtree(ZID)
os.rename(top, ZID); os.remove(ZID+".zip")
PY
```

В итоге `~/.zepp/emulator_cache/9910c32ad75b6de37632c333491695d8/` содержит
`main.elf` и `norflash.bin`.

## 3. Прописать устройство в конфиг симулятора

Симулятор держит список скачанных устройств в `~/.config/simulator/config.json`
(electron-store). Прописываем `selectDeviceList` и `platform`:

```
python3 - <<'PY'
import json, os
cfgp=os.path.expanduser("~/.config/simulator/config.json")
cfg=json.load(open(cfgp))
lst=json.load(open("/tmp/emulatorList.json"))
entry=rel=None
for e in lst:
    if e.get("modelName")=="GTS 4" and 7995648 in (e.get("device") or []):
        for r in e.get("released",[]):
            if r.get("code")=="1.1.0": entry, rel = e, r
params={"deviceImage":entry["deviceImage"],"device":entry["device"],
        "modelName":entry["modelName"],"deviceLimit":entry.get("limit"),
        **rel,"status":1,"process":0}
cfg["selectDeviceList"]=json.dumps([params])
cfg["platform"]=rel["id"]
json.dump(cfg, open(cfgp,"w"), indent="\t", ensure_ascii=False)
PY
```

## 4. Патч QEMU-сети (обязательно)

Прошивка поднимает WS-сервер на своём IP. GTS 4 использует `192.168.166.188:7833`,
Bip 6 — `10.0.2.15:7833`. `start_qemu.sh` теперь **сам определяет** подсеть по
содержимому `main.elf`:

```
if grep -aq "192.168.166.188" "$firmware"; then
  opt_network="-nic user,id=usernet,net=192.168.166.0/24,host=192.168.166.1,hostfwd=tcp::7833-192.168.166.188:7833,model=lan9118"
else
  opt_network="-nic user,id=usernet,net=10.0.2.0/24,host=10.0.2.2,hostfwd=tcp::7833-10.0.2.15:7833,model=lan9118"
fi
```

Так попеременно работают и GTS 4, и Bip 6. Добавление новых моделей и ручной патч —
в [add-device-simulator.md](add-device-simulator.md).

## 5. Запустить симулятор

```
env -u ELECTRON_RUN_AS_NODE -u NODE_OPTIONS /opt/simulator/simulator
```

`ELECTRON_RUN_AS_NODE` (наследуется от VS Code) обязателен к снятию.

## 6. Запустить часы-эмулятор

В окне симулятора нажать кнопку **Emulator** (слева сверху). Запустится QEMU
(`qemu-system-arm`, окно «Zepp OS Simulator»).

Проверка готовности:

```
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:7833/   # ожидаем 200
```

В логах симулятора должно появиться `Client:open` и `Service: Success!`.

## 7. Установить и запустить приложение

```
cd ~/zepp-dev/hello-world
zeus dev          # выбрать Amazfit GTS 4 в списке устройств
```

`zeus dev` подключится к `127.0.0.1:7650`, соберёт пакет, задеплоит
(deviceSources 7995648, 7995649) и откроет приложение на эмуляторе.

## 8. Проверка

На экране эмулятора GTS 4 отображается содержимое приложения (для hello-world —
«Hello World»).

## Автоматизация GUI (опционально)

Окно симулятора — Electron с включённым remote debugging. Порт:
`ss -ltnp | grep simulator | grep 127.0.0.1`. Через CDP можно читать DOM и кликать
(например, кнопку «Emulator»), что использовалось при отладке вместо ручных кликов.

## Связанные страницы

- [../entities/zepp-os-simulator.md](../entities/zepp-os-simulator.md)
- [troubleshooting.md](troubleshooting.md)
- [create-build.md](create-build.md)
