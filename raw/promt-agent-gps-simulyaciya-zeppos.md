# Промт для ИИ-агента: имитация GPS-сигнала в эмуляторе Zepp OS (Ubuntu 24.04)

> Самодостаточная инструкция. Предполагается, что среда разработки Zepp OS уже настроена (Ubuntu 24.04, Node.js + Zeus CLI, VS Code, Zepp OS Simulator v2.1.2, модель Amazfit GTS 4 скачана через Device Simulator download manager) и тестовое мини-приложение собирается и запускается через `zeus dev`.

---

## РОЛЬ И ЦЕЛЬ

Ты — инженер по отладке встраиваемых систем. Задача: организовать **имитацию GPS-сигнала** в Zepp OS Simulator, чтобы мини-приложение получало заранее заданные координаты (перемещение по маршруту) вместо заводского трека. Дополнительно ты должен кратко задокументировать, как при необходимости имитируются другие сенсоры (пульс, SpO₂ и т.д.). Работай автономно, шаг за шагом; в конце выдай отчёт по заданному формату.

## КАК ЭТО РАБОТАЕТ (техническая справка — проверено разбором симулятора)

- Симулятор — это QEMU (`qemu-system-arm -M mps2-an521`), запускающий ARM-прошивку конкретной модели часов. Storage прошивки — файл `norflash.bin` (внутри FAT16) рядом с `main.elf`.
- Сенсоры в эмуляторе питаются из текстовых/бинарных файлов-логов в каталоге `/virtual_sensor_data/` внутри `norflash.bin`:
  - `fake_data_gps.dat` — **обычный текстовый NMEA-лог** ($GNGGA, $GNRMC, $GNZDA, $GNGSA, $GxGSV + служебные $PAIR-предложения чипа Airoha в начале);
  - `fake_data_ppg.dat` (пульс), `fake_data_spo2.dat` (сатурация), `fake_data_temp.dat` (температура), `fake_data_pressure.dat` (давление), `fake_data_acc.dat` (акселерометр), `fake_data_gyro.dat`, `fake_data_compass.dat`, `fake_data_ecg.dat`.
- Заводское содержимое `fake_data_gps.dat` — записанный трек в Пекине (≈40.0989°N, 116.2556°E), 1 Гц. Пока файл не заменён, любой Geolocation-код в мини-аппе видит именно его.
- Вывод: чтобы «телепортировать» или «прокатить» эмулятор по нужному маршруту, достаточно заменить `fake_data_gps.dat` на собственный NMEA-лог и перезапустить Device Simulator. Имена файлов менять нельзя.

## ПЛАН РАБОТ

### Шаг 0 — Диагностика окружения
Убедись и зафиксируй:
- `zeus -v` работает; симулятор установлен (`.deb`, бинарник в `/opt/simulator`).
- Модель GTS 4 скачана в Device Simulator (если нет — открой симулятор, в download manager скачай модель «Amazfit GTS 4»; без этого образа дальше работать нечем).
- Определи, где лежит **используемый** образ: запусти Device Simulator с GTS 4 и выполни:
  ```bash
  ls -la /proc/$(pgrep -f qemu-system-arm)/fd 2>/dev/null | grep -iE "flash|nor"
  find ~/.zepp /opt/simulator ~/snap -iname "norflash.bin" 2>/dev/null
  ```
  Если найдено несколько — выбирай тот, что открыт процессом QEMU (первая команда), либо каталог с именем модели (gts4). Путь зафиксируй: `<IMG>`.

### Шаг 1 — Безопасность
- Останови симулятор полностью (закрой Device Simulator и главное окно; проверь `pgrep -f qemu-system-arm` — процесс должен отсутствовать). Редактировать образ при работающем QEMU нельзя — изменения будут перезаписаны/потеряны.
- Сделай бэкап: `cp "<IMG>" "<IMG>.bak"`.

### Шаг 2 — Инструменты и осмотр образа
```bash
sudo apt install -y mtools gpsbabel python3
mdir -i "<IMG>" ::/virtual_sensor_data
mcopy -i "<IMG>" ::/virtual_sensor_data/fake_data_gps.dat ./original_fake_data_gps.dat
head -20 ./original_fake_data_gps.dat
```
Сохрани первые строки оригинала: служебные предложения `$PAIR...`/`$GNZDA` из начала файла используем как «шапку» (они конфигурируют эмулируемый GNSS-приёмник).

### Шаг 3 — Сгенерировать свой NMEA-маршрут
Сохрани скрипт-генератор в `~/zepp-dev/make_nmea.py`:

```python
#!/usr/bin/env python3
"""Генератор NMEA-лога для /virtual_sensor_data/fake_data_gps.dat (Zepp OS Simulator).
Формирует трек по опорным точкам с интерполяцией, 1 Гц, с корректными чексуммами."""
import math, argparse, datetime

def cs(body: str) -> str:
    x = 0
    for ch in body: x ^= ord(ch)
    return f"{x:02X}"

def nmea(body: str) -> str:
    return f"${body}*{cs(body)}\n"

def to_dm(deg: float, is_lat: bool) -> str:
    hem = ('N' if deg >= 0 else 'S') if is_lat else ('E' if deg >= 0 else 'W')
    d = int(abs(deg)); m = (abs(deg) - d) * 60
    return f"{d:02d}{m:07.4f},{hem}" if is_lat else f"{d:03d}{m:07.4f},{hem}"

def hav(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = math.radians(b[0]-a[0]); dl = math.radians(b[1]-a[1])
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))

def bearing(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dl = math.radians(b[1]-a[1])
    y = math.sin(dl)*math.cos(p2)
    x = math.cos(p1)*math.sin(p2) - math.sin(p1)*math.cos(p2)*math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360

# Статичная «спутниковая обстановка» — правдоподобные GSA/GSV (без начального $)
GSA = "GNGSA,A,3,06,07,09,11,16,19,23,25,,,,,1.34,0.94,0.95"
GSV = ["GPGSV,2,1,08,03,45,111,42,06,67,210,46,07,32,150,40,11,21,290,38",
       "GPGSV,2,2,08,16,55,045,44,19,24,120,39,23,12,310,35,25,08,080,33",
       "GLGSV,1,1,04,65,40,070,40,66,55,140,44,72,30,220,38,81,15,300,30"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="fake_data_gps.dat")
    ap.add_argument("--speed-kmh", type=float, default=4.5, help="скорость движения")
    ap.add_argument("--start", default="02:00:00", help="UTC-время старта HH:MM:SS")
    ap.add_argument("--date", default="2026-01-15", help="дата YYYY-MM-DD")
    ap.add_argument("--header", default="", help="путь к оригинальному .dat для копирования $PAIR-шапки")
    ap.add_argument("waypoints", nargs="+",
                    help="пары 'lat,lon' через пробел; для замкнутого кольца повтори первую точку в конце")
    a = ap.parse_args()

    pts = []
    for w in a.waypoints:
        la, lo = w.split(",")
        pts.append((float(la), float(lo)))
    if len(pts) < 2:
        ap.error("нужно минимум 2 точки")

    hh, mm, ss = map(int, a.start.split(":"))
    y_, m_, d_ = map(int, a.date.split("-"))
    t = datetime.time(hh, mm, ss)
    spd_kn = a.speed_kmh / 1.852

    with open(a.out, "w", newline="\n") as f:
        if a.header:  # шапка из оригинала: строки до первого $GNGGA (PAIR-конфиг и т.п.)
            for line in open(a.header, encoding="utf-8", errors="replace"):
                if line.startswith("$") and not line.startswith("$GN") and not line.startswith("$GP") \
                   and not line.startswith("$GL") and not line.startswith("$GA"):
                    f.write(line if line.endswith("\n") else line + "\n")
        step = 0
        for i in range(len(pts) - 1):
            A, B = pts[i], pts[i+1]
            dist = hav(A, B)
            brg = bearing(A, B)
            n = max(1, int(dist / (a.speed_kmh / 3.6)))  # сек на сегмент при данной скорости
            for k in range(n):
                f_ = k / n
                lat = A[0] + (B[0]-A[0]) * f_
                lon = A[1] + (B[1]-A[1]) * f_
                tt = (datetime.datetime.combine(datetime.date.today(), t)
                      + datetime.timedelta(seconds=step)).time()
                ts = tt.strftime("%H%M%S") + ".000"
                f.write(nmea(GSA)); [f.write(nmea(g)) for g in GSV]
                f.write(nmea(f"GNGGA,{ts},{to_dm(lat,True)},{to_dm(lon,False)},1,9,0.94,45.0,M,-6.8,M,,"))
                f.write(nmea(f"GNRMC,{ts},A,{to_dm(lat,True)},{to_dm(lon,False)},"
                             f"{spd_kn:.1f},{brg:.1f},{d_:02d}{m_:02d}{y_%100:02d},,,A"))
                f.write(nmea(f"GNVTG,{brg:.1f},T,,M,{spd_kn:.1f},N,{a.speed_kmh:.1f},K,A"))
                f.write(nmea(f"GNZDA,{ts},{d_:02d},{m_:02d},{y_:04d},,"))
                step += 1
    print(f"OK: {a.out} ({step} точек, 1 Гц)")

if __name__ == "__main__":
    main()
```

Сгенерируй тестовый маршрут (пример — кольцо по центру Владивостока; координаты можно заменить на любые):
```bash
cd ~/zepp-dev
python3 make_nmea.py --out my_track.nmea --header ./original_fake_data_gps.dat \
  --speed-kmh 4.5 --start 02:00:00 --date 2026-01-15 \
  43.1155,131.8855 43.1185,131.8900 43.1205,131.8860 43.1170,131.8825 43.1155,131.8855
```
Проверь валидность пары предложений (контрольная сумма = XOR всех символов между `$` и `*`):
```bash
head -12 my_track.nmea
python3 - << 'EOF'
ok=True
for ln in open('my_track.nmea'):
    ln=ln.strip()
    if not ln.startswith('$'): ok=False; print('bad line:', ln); continue
    body, cks = ln[1:].split('*')
    x=0
    for ch in body: x ^= ord(ch)
    if f"{x:02X}" != cks: ok=False; print('bad cs:', ln)
print('CHECKSUMS OK' if ok else 'CHECKSUM FAIL')
EOF
```

### Шаг 4 — Залить трек в образ и перезапустить
```bash
mdel -i "<IMG>" ::/virtual_sensor_data/fake_data_gps.dat 2>/dev/null
mcopy -i "<IMG>" my_track.nmea ::/virtual_sensor_data/fake_data_gps.dat
mdir -i "<IMG>" ::/virtual_sensor_data
```
(Имя внутри образа обязано остаться `fake_data_gps.dat`. Если mcopy ругается на нехватку места — mdel выполнен выше; размер своего файла держи ≲2 МБ.)

Полностью запусти Simulator → Device Simulator (GTS 4). GPS-приёмник эмулятора теперь проигрывает твой трек с 1 Гц.

### Шаг 5 — Проверка из мини-приложения
В существующем проекте создай тестовую страницу (или добавь временный лог в текущую):
```js
// pages/geo-test/index.js — Zepp OS 3.x
import { Geolocation } from '@zos/sensor'

const geo = new Geolocation()
geo.start()
geo.onChange(() => {
  console.log('GEO', geo.getStatus(),
    'lat:', geo.getLatitude({ format: 'DD' }),
    'lon:', geo.getLongitude({ format: 'DD' }))
})
```
Запусти `zeus dev`, открой страницу, смотри лог в консоли/окне симулятора.

**Критерий успеха:** в логе координаты начинаются около `43.1155 / 131.8855` (первые точки маршрута) и плавно движутся к следующим точкам со скоростью ≈4.5 км/ч, `getStatus()` возвращает `A`. Если приложение использует старый API (`hmSensor.id.GEOLOCATION`) — результат должен быть тем же.

### Шаг 6 — Откат (если понадобится)
```bash
cp "<IMG>.bak" "<IMG>"   # вернуть заводской трек
```
Крайняя мера: удалить каталог данных симулятора `~/.zepp` и заново скачать модель (полный сброс, вернёт Пекин).

## КРАТКО: ДРУГИЕ СЕНСОРЫ
Тот же механизм, файлы в `/virtual_sensor_data/`: `fake_data_ppg.dat` (пульс), `fake_data_spo2.dat` (сатурация), `fake_data_temp.dat` (температура кожи), `fake_data_pressure.dat` (барометр), `fake_data_acc.dat` / `fake_data_gyro.dat` (акселерометр/гироскоп), `fake_data_compass.dat`, `fake_data_ecg.dat`. Форматы отличаются от NMEA и подбираются по заводским файлам из образа (текстовые строки-выборки); GPS — единственный с готовым универсальным текстовым форматом. В рамках этой задачи другие сенсоры НЕ трогай — только зафиксируй их наличие в отчёте.

## ТИПИЧНЫЕ ПРОБЛЕМЫ
- `mdir`/`mcopy` не открывают образ → файл не FAT16 или это zip-архив модели: распакуй zip (`gts4_os35*.zip`) и работай с `norflash.bin` внутри.
- Изменения «пропали» после перезапуска → образ редактировался при работающем QEMU, либо правился не тот файл (симулятор хранит копии моделей; ориентируйся на открытые дескрипторы QEMU, Шаг 0).
- В приложении нет фикса (статус `V`, пустые координаты) → проверь чексы NMEA (скрипт из Шага 3), наличие `$GNGGA` с полем fix=1 и непустыми координатами, сохранил ли ты `$PAIR`-шапку; перезапусти Device Simulator целиком.
- Симулятор после подмены не стартует → верни бэкап, проверь целостность FAT (`mdir -i "<IMG>" ::/`), повтори замену при выключенном симуляторе.
- Файл «сбросился» к завоскому → модель была перекачана через download manager — повтори инъекцию.

## ФОРМАТ ОТЧЁТА
1. Путь к найденному образу `<IMG>` (и бэкапа), список файлов `/virtual_sensor_data/`.
2. Команда генерации маршрута (точки, скорость, время) + размер и число точек NMEA-файла.
3. Результат проверки чексумм.
4. Лог мини-приложения: первые 5 строк `GEO ...` и вывод по критерию успеха (совпадение с маршрутом: ДА/НЕТ).
5. Статус по другим сенсорам: перечень найденных fake_data-файлов (без модификации).
6. Откат не выполнялся / выполнялся (причина).
