# Процедура: добавление модели устройства в симулятор

---
type: procedure
tags: [simulator, qemu, device, bip6]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

Обобщает шаги для GTS 4 ([simulator-dev.md](simulator-dev.md)) на любую модель, в т.ч.
**Amazfit Bip 6**. Проверено 2026-09-12: образ Bip 6 скачан и запущен.

## 1. Найти релиз образа

```
curl -s https://upload-cdn.huami.com/zeppos/simulator/download/emulatorList.json -o /tmp/emulatorList.json
```

В списке найти запись по `modelName` и выбрать релиз `code`. Для Bip 6:

| code | os | api_level | id | файл |
|---|---|---|---|---|
| 1.1.0 | 5.0 | 4.2 | `4ae8ec66a7e2d342faf040652f4f41ff` | `20251027/bip6_os50_v110.zip` |
| 1.0.0 | 4.5 | 4.0 | `ccee6b769df8b31b30575b382ad6fd81` | `20250409/bip6_os40_v100.zip` |

## 2. Разложить образ в кэш

Приложение качает ZIP в `~/.zepp/emulator_cache/<id>.zip`, распаковывает и переименовывает
верхнюю папку в `<id>`. Вручную — то же самое:

```
cd ~/.zepp/emulator_cache
curl -sL -o <id>.zip "<filePath>"
python3 - <<'PY'
import zipfile, os, shutil
ZID="<id>"
z=zipfile.ZipFile(ZID+".zip"); names=z.namelist(); z.extractall(".")
top=[n.split('/')[0] for n in names if '/' in n][0]
if os.path.exists(ZID): shutil.rmtree(ZID)
os.rename(top, ZID); os.remove(ZID+".zip")
PY
```

Внутри должны появиться `main.elf` и `norflash.bin`.

## 3. Дописать устройство в конфиг симулятора

`~/.config/simulator/config.json` (electron-store): `selectDeviceList` — JSON-строка со
**всеми** скачанными образами, `platform` — id активного. Важно **дописывать**, а не
заменять список, иначе пропадут ранее добавленные модели:

```
python3 - <<'PY'
import json, os
cfgp=os.path.expanduser("~/.config/simulator/config.json")
cfg=json.load(open(cfgp)); lst=json.load(open("/tmp/emulatorList.json"))
entry=rel=None
for e in lst:
    if e.get("modelName")=="Bip 6":
        for r in e.get("released",[]):
            if r.get("code")=="1.1.0": entry, rel = e, r
params={"deviceImage":entry["deviceImage"],"device":entry["device"],
        "modelName":entry["modelName"],"deviceLimit":entry.get("limit"),
        **rel,"status":1,"process":0}
cur=json.loads(cfg.get("selectDeviceList") or "[]")
cur=[p for p in cur if p.get("id")!=params["id"]] + [params]
cfg["selectDeviceList"]=json.dumps(cur); cfg["platform"]=params["id"]
json.dump(cfg, open(cfgp,"w"), indent="\t", ensure_ascii=False)
PY
```

## 4. Выбрать модель по умолчанию для `zeus dev`

`zeus dev` — интерактивный список **из кэша** `~/.zepp/.zeus_devices` (не из
`emulatorList.json`). Bip 6 там есть после `zeus login` (productName `Amazfit Bip 6`).
Чтобы не кликать стрелками, значение по умолчанию пишется в `~/.zepp/.zeus` (dotenv):

```
____zeus_development_device=Amazfit Bip 6    # dev; для build — ____zeus_build_device
```

Тогда достаточно `printf '\n' | zeus dev` (Enter принимает дефолт).

## 5. Сеть QEMU (важно для Bip 6)

Прошивка задаёт собственный IP гостя. GTS 4 — `192.168.166.188`, Bip 6 — `10.0.2.15`.
`start_qemu.sh` определяет нужную usernet-подсеть по содержимому прошивки:

```bash
if grep -aq "192.168.166.188" "$firmware"; then
    opt_network="-nic user,id=usernet,net=192.168.166.0/24,host=192.168.166.1,hostfwd=tcp::7833-192.168.166.188:7833,model=lan9118"
else
    opt_network="-nic user,id=usernet,net=10.0.2.0/24,host=10.0.2.2,hostfwd=tcp::7833-10.0.2.15:7833,model=lan9118"
fi
```

Так GTS 4 и Bip 6 работают попеременно без ручной правки скрипта. Для неизвестной модели
ищите её IP в `main.elf`: `grep -aoE '(10\.0\.2|192\.168\.[0-9]+)\.[0-9]+' main.elf`.

## 6. Запуск и проверка

1. Запустить симулятор: `env -u ELECTRON_RUN_AS_NODE -u NODE_OPTIONS /opt/simulator/simulator`.
2. Нажать **Emulator** (в GUI; при автоматизации — click по `<span>Emulator</span>` через
   CDP). QEMU поднимется с активной моделью.
3. `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:7833/` → `200`.
4. `zeus dev` → деплой на выбранную модель (deviceSources Bip 6:
   `9765120, 9765121, 10158337`).

## Связанные страницы

- [simulator-dev.md](simulator-dev.md)
- [app-development.md](app-development.md)
- [../entities/amazfit-bip6.md](../entities/amazfit-bip6.md)
- [troubleshooting.md](troubleshooting.md)
