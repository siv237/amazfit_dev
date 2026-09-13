# Промт для ИИ-агента: имитация ВСЕХ сенсоров в эмуляторе Zepp OS (компас — приоритет №1, Ubuntu 24.04)

> Самодостаточная инструкция. Предполагается: среда Zepp OS настроена (Ubuntu 24.04, Zeus CLI, VS Code, Simulator v2.1.2, модель Amazfit GTS 4 скачана), мини-приложение запускается через `zeus dev`.

---

## РОЛЬ И ЦЕЛЬ

Ты — инженер по отладке встраиваемых систем. Задача — организовать имитацию сенсоров в Zepp OS Simulator так, чтобы мини-приложение получало управляемые тестовые данные вместо заводских. **Главный приоритет — компас (магнитометр)**: нужно добиться управляемого изменения азимута. Остальные сенсоры — по списку ниже, каждый отдельным шагом: акселерометр, гироскоп, пульс (PPG), SpO₂, температура, давление/высотомер. Форматы установлены разбором прошивки GTS 4 (отладочные символы) и её flash-образа — тебе не нужно их угадывать.

## КАК УСТРОЕН МЕХАНИЗМ (справка, проверено)

- Симулятор = QEMU (`qemu-system-arm -M mps2-an521`) + ARM-прошивка модели. Storage прошивки — файл `norflash.bin` (FAT16) рядом с `main.elf`, в каталоге скачанной модели.
- Внутри образа есть каталог `/virtual_sensor_data/`. Прошивка (модуль `fake_data_proc.c`) при старте загружает оттуда файлы вида `fake_data_<sensor>.dat` и **проигрывает их построчно вместо реальных сенсоров**; когда файл кончается — проигрывание зацикливается. Если файла нет — сенсор работает в «пустом» режиме (заводские значения по умолчанию).
- Все файлы текстовые, по одной выборке на строку. Разделитель — запятая. Заголовок-строка с именами колонок допускается (парсер пропускает нечисловые строки).
- Поддерживаемые типы (перечисление из прошивки): `gps, acc, gyro, compass, ppg, ppg_3pd, spo2, spo2_3pd, pressure, temp, ecg`. Плюс служебные файлы спортивных алгоритмов (`indoor_motion.dat`, `row_accel.dat`, `swim_accel.dat`, `tennis_accel.dat`, `skiprope_accel.dat` — формат как у acc).
- Люксметр (ALS, автояркость) через этот механизм **не имитируется** — fake-файла для него в прошивке нет. Не трать на него время, просто отметь в отчёте.
- ECG (`fake_data_ecg.dat`) существует, но у GTS 4 нет ECG-электродов — пропусти (модель-зависимо).

## ШАГ 0 — НАЙТИ ОБРАЗ И ПОДГОТОВИТЬСЯ

1. Останови симулятор (Device Simulator и главное окно закрыты; `pgrep -f qemu-system-arm` пуст). Редактировать образ при живом QEMU нельзя.
2. Найди образ используемой модели:
   ```bash
   ls -la /proc/$(pgrep -f qemu-system-arm)/fd 2>/dev/null | grep -iE "flash|nor"   # способ 1 (при запущенном QEMU)
   find ~/.zepp /opt/simulator ~/snap -iname "norflash.bin" 2>/dev/null             # способ 2
   ```
   Если несколько — бери открытый QEMU-процессом или в каталоге с именем модели (gts4). Зафиксируй путь `<IMG>`.
3. Бэкап: `cp "<IMG>" "<IMG>.bak"`.
4. Инструменты: `sudo apt install -y mtools python3`.
5. Осмотр: `mdir -i "<IMG>" ::/virtual_sensor_data`.
   Ожидаемо в заводском образе GTS 4 ЕСТЬ файлы: `fake_data_acc.dat`, `fake_data_gps.dat`, `fake_data_gyro.dat`, `fake_data_ppg.dat`, `fake_data_ppg_3pd.dat`, `fake_data_pressure.dat`, `fake_data_spo2.dat`, `fake_data_spo2_3pd.dat`, `fake_data_temp.dat`, `indoor_motion.dat` и др. **Файла `fake_data_compass.dat` НЕТ — его нужно создать** (имя должно быть в точности таким).

## ГЛАВНЫЙ БЛОК — КОМПАС (магнитометр)

### Формат (подтверждён структурой из прошивки)
`fake_data_compass.dat` — по одной выборке на строку, три целых числа:
```
x,y,z
```
где `x, y, z` — int16 (−32768…32767): компоненты вектора магнитного поля в raw-единицах магнитометра. Структура из прошивки: `magnetic_data_t { int16_t x; int16_t y; int16_t z; }`. Направление (азимут) вычисляется алгоритмом из горизонтальных компонент (по сути `atan2`). Для стабильного вращения азимута: `x = R·cos(θ)`, `y = R·sin(θ)`, `z = константа` (вертикальная компонента), где θ плавно растёт во времени. Рекомендуемые амплитуды: R = 12000…20000, z = 3000…8000. Значения должны слегка «дрожать» (±1–2%) — идеально постоянное поле может мешать алгоритму калибровки.

### Генератор
Сохрани скрипт `~/zepp-dev/make_sensor_data.py`:

```python
#!/usr/bin/env python3
"""Генератор fake_data файлов для /virtual_sensor_data/ (Zepp OS Simulator)."""
import math, argparse, random

def compass(args):
    rows = []
    total = int(args.seconds * args.rate)
    rng = random.Random(42)
    for i in range(total):
        theta = math.radians(args.deg_per_sec * i / args.rate)
        x = args.radius * math.cos(theta) * (1 + rng.uniform(-0.015, 0.015))
        y = args.radius * math.sin(theta) * (1 + rng.uniform(-0.015, 0.015))
        z = args.vertical * (1 + rng.uniform(-0.01, 0.01))
        rows.append(f"{int(x)},{int(y)},{int(z)}")
    return rows

def pressure(args):
    # Барометрическая формула: P(h) = P0 * (1 - 2.25577e-5*h)^5.25588, Па
    rows = []
    total = int(args.seconds * args.rate)
    rng = random.Random(7)
    for i in range(total):
        h = args.alt_start + (args.alt_end - args.alt_start) * i / max(1, total - 1)
        p = 101325.0 * (1 - 2.25577e-5 * h) ** 5.25588
        rows.append(f"{int(p + rng.uniform(-8, 8))},{args.temp_c + rng.uniform(-0.3, 0.3):.0f}")
    return rows

def acc(args):
    rows = ["x,y,z,t,p"]  # заголовок как в заводском файле
    total = int(args.seconds * args.rate)
    rng = random.Random(3)
    for i in range(total):
        ax = int(300 + 200 * math.sin(2 * math.pi * 1.5 * i / args.rate) + rng.uniform(-25, 25))
        ay = int(800 + 200 * math.cos(2 * math.pi * 1.2 * i / args.rate) + rng.uniform(-25, 25))
        az = int(3900 + rng.uniform(-120, 120))  # ~1g по Z
        rows.append(f"{ax},{ay},{az},,")
    return rows

def gyro(args):
    rows = []
    total = int(args.seconds * args.rate)
    rng = random.Random(5)
    for i in range(total):
        rows.append(f"{int(rng.uniform(-30,30))},{int(rng.uniform(-30,30))},{int(rng.uniform(-30,30))}")
    return rows

SENSORS = {'compass': compass, 'pressure': pressure, 'acc': acc, 'gyro': gyro}

ap = argparse.ArgumentParser()
ap.add_argument('sensor', choices=SENSORS.keys())
ap.add_argument('--out', required=True)
ap.add_argument('--seconds', type=float, default=60.0, help='длительность данных')
ap.add_argument('--rate', type=float, default=25.0, help='частота выборок, Гц')
# compass
ap.add_argument('--deg-per-sec', type=float, default=20.0, help='скорость вращения азимута')
ap.add_argument('--radius', type=int, default=15000, help='горизонтальная амплитуда поля')
ap.add_argument('--vertical', type=int, default=6000, help='вертикальная компонента z')
# pressure
ap.add_argument('--alt-start', type=float, default=0.0, help='высота старта, м')
ap.add_argument('--alt-end', type=float, default=0.0, help='высота конца, м')
ap.add_argument('--temp-c', type=float, default=25.0, help='температура для второй колонки')
ap.add_argument('extra', nargs='*')
a = ap.parse_args()
rows = SENSORS[a.sensor](a)
open(a.out, 'w', newline='\n').write('\n'.join(rows) + '\n')
print(f"OK: {a.out} — {len(rows)-1 if rows[0].startswith('x,y,z') else len(rows)} выборок")
```

Сгенерируй компасный файл (вращение 20°/сек ≈ полный круг за 18 сек, файл на 60 сек):
```bash
cd ~/zepp-dev
python3 make_sensor_data.py compass --out fake_data_compass.dat --seconds 60 --rate 25 --deg-per-sec 20
head -5 fake_data_compass.dat
```

### Инъекция
```bash
mcopy -i "<IMG>" fake_data_compass.dat ::/virtual_sensor_data/fake_data_compass.dat
mdir -i "<IMG>" ::/virtual_sensor_data | grep compass   # файл должен появиться
```
(Файла раньше не было — mdel не нужен. Если место в FAT закончится — удали что-то необязательное, например старый `fake_data_spo2_3pd.dat`, предварительно забэкапив.)

### Проверка компаса
Тестовая страница в проекте:
```js
// pages/compass-test/index.js — Zepp OS 3.x (API_LEVEL 3.0, permission device:os.compass)
import { Compass } from '@zos/sensor'

const compass = new Compass()
compass.start()
compass.onChange(() => {
  console.log('CMP dir:', compass.getDirection(),
    'angle:', compass.getDirectionAngle(),
    'calibrated:', compass.getStatus())
})
```
Запусти `zeus dev`, открой страницу, смотри лог.

**Критерий успеха:** `angle` в логе растёт примерно на 20° за каждую секунду реального времени, циклически 0→360, `dir` проходит N→NE→E→SE→S→SW→W→NW.

### Нюансы компаса (важно!)
- `getDirectionAngle()` возвращает `'INVALID'`, пока алгоритм не откалиброван. С синтетическим полем калибровка обычно проходит за несколько секунд; если INVALID держится — добавь шум посильнее (±3–5% вместо ±1.5%) или сначала выведи константное поле на 10 сек (deg-per-sec 0), а затем вращение (сделай два файла-прохода в одном: первые N строк — константа, дальше вращение).
- Проигрывание зацикливается по исчерпании файла — вращение будет повторяться бесконечно, это нормально.
- Если заводское приложение «Компас» на эмуляторе показывает стрелку/азимут по твоим данным — механизм работает и для твоего приложения.

## ОСТАЛЬНЫЕ СЕНСОРЫ (каждый — отдельный шаг по той же схеме: сгенерировать → mcopy → перезапуск → проверить)

### 1. Акселерометр — `fake_data_acc.dat`
- Формат: заголовок `x,y,z,t,p`, дальше строки `ax,ay,az,,` (raw mg-подобные единицы; колонки t/p пустые, их заполняет драйвер).
- Генерация: `python3 make_sensor_data.py acc --out fake_data_acc.dat --seconds 60 --rate 25`
- Проверка:
  ```js
  import { Accelerometer } from '@zos/sensor'
  const acc = new Accelerometer(); acc.start()
  acc.onChange(() => console.log('ACC', acc.getX(), acc.getY(), acc.getZ()))
  ```
- Критерий: значения колеблются по синусоидам вокруг (300, 800, 3900) — генератор даёт именно это.

### 2. Гироскоп — `fake_data_gyro.dat`
- Формат: `x,y,z` на строку, без заголовка (raw единицы угловой скорости).
- Генерация: `python3 make_sensor_data.py gyro --out fake_data_gyro.dat --seconds 60 --rate 25`
- Проверка: класс `Gyroscope` из `@zos/sensor` (getX/getY/getZ через onChange).
- Критерий: малые значения около нуля (±30), без аварий/ошибок.

### 3. Давление / высотомер — `fake_data_pressure.dat`
- Формат: `давление_Па,температура_C` на строку (пример завода: `101199,25` ≈ 1011.99 гПа, 25 °C).
- Генерация (подъём на 200 м): `python3 make_sensor_data.py pressure --out fake_data_pressure.dat --seconds 60 --rate 25 --alt-start 0 --alt-end 200 --temp-c 25`
- Проверка:
  ```js
  import { Barometer } from '@zos/sensor'
  const b = new Barometer(); b.onChange(() => console.log('BAR', b.getAirPressure(), 'hPa', b.getAltitude(), 'm'))
  ```
- Критерий: `getAirPressure()` ≈ 1013 гПа у земли и снижается к ~989 гПа; `getAltitude()` растёт к ≈200 м. Формула в генераторе — стандартная барометрическая, совпадает с алгоритмом часов с точностью ≈1 м.

### 4. Пульс — `fake_data_ppg.dat`
- Формат: заголовок `PPG,t`, дальше `значение,` — один raw-сэмпл фотоплетизмограммы на строку (заводские значения около −21000).
- Генерация: приложи к строкам файла синусоиду пульса (по умолчанию 70 уд/мин = 1.1667 Гц):
  ```bash
  python3 - << 'EOF'
  import math
  rate, bpm, secs = 25, 70, 60
  rows = ["PPG,t"]
  for i in range(int(secs*rate)):
      t = i/rate
      v = -21000 + 3500*math.sin(2*math.pi*bpm/60*t) + 800*math.sin(2*math.pi*2*bpm/60*t)
      rows.append(f"{int(v)},")
  open('fake_data_ppg.dat','w').write('\n'.join(rows)+'\n')
  print('OK')
  EOF
  ```
- Проверка:
  ```js
  import { HeartRate } from '@zos/sensor'
  const hr = new HeartRate()
  hr.onCurrentChange(() => console.log('HR', hr.getCurrent(), 'last:', hr.getLast()))
  ```
- **Честное предупреждение:** пульс считается алгоритмом из формы волны PPG. Синусоида 70 уд/мин обычно распознаётся, но точное число может отличаться (60–80). Если алгоритм выдаёт «нет данных» — увеличь амплитуду (до 6000–8000) или добавь гармоники/шум; подбирай итеративно по логу.
- Каталог с фиксированным пульсом: `getCurrent()` — только в колбэке `onCurrentChange`; `getToday()` отдаёт массив за сутки (заполняется системным монитором, не fake-файлом напрямую).

### 5. SpO₂ — `fake_data_spo2.dat`
- Формат: `v1,v2,v3[,t,p]` на строку — три raw-канала (заводской файл — почти все `1,1,1,,`, что даёт «нет измерения»).
- Подход: формат подтверждён, но маппинг «raw → % SpO₂» зашит в алгоритме и документацией не раскрывается. Стратегия агента: итеративный подбор — попробуй значения вида `60000,52000,47000` (и вариации вокруг них с плавной модуляцией), проверь:
  ```js
  import { BloodOxygen } from '@zos/sensor'
  const bo = new BloodOxygen()
  bo.onCurrentChange(() => console.log('SPO2', bo.getCurrent()))  // retCode 2 = успешное измерение
  ```
- Критерий: `retCode == 2` и вменяемое значение 90–100. Если не удаётся за ~5 итераций — зафиксируй в отчёте «формат подтверждён, калибровка алгоритма не завершена» и остановись (это допустимый исход).

### 6. Температура — `fake_data_temp.dat`
- Формат: `raw1,raw2` на строку (заводские ~`3705,3173`, что соответствует ~30–32 °C на коже).
- Подход: как со SpO₂ — алгоритм пересчёта raw→°C скрыт. Сначала замерь базу (что показывает `BodyTemperature.getCurrent()` при заводском файле), затем плавно меняй значения на ±2–5% и наблюдай сдвиг температуры. Итеративно выйди на целевые ~36.6 °C.
- Проверка:
  ```js
  import { BodyTemperature } from '@zos/sensor'
  const bt = new BodyTemperature()
  bt.onChange(() => console.log('TEMP', bt.getCurrent()))
  ```

### Справочно: GPS
GPS имитируется отдельно файлом `fake_data_gps.dat` (текстовый NMEA-лог $GNGGA/$GNRMC/…) — если он ещё не настроен, используй отдельную инструкцию по GPS-симуляции (есть у владельца проекта). Здесь GPS не трогай.

## ПОРЯДОК РАБОТЫ И ФИНАЛ
- Рекомендуемый порядок: **компас → давление → акселерометр → гироскоп → пульс → SpO₂ → температура**. Каждый сенсор — полный цикл (генерация, mcopy, перезапуск Device Simulator, проверка из мини-приложения) до перехода к следующему.
- После каждого сенсора фиксируй результат; неудача не блокирует остальные.
- Перед КАЖДОЙ инъекцией: симулятор остановлен; после КАЖДОЙ — Device Simulator перезапущен полностью.
- Если что-то сломалось — откат `cp "<IMG>.bak" "<IMG>"` и повторная инъекция только нужного файла.
- Крайний сброс: удалить `~/.zepp` и заново скачать модель (вернёт заводское состояние всего).

## ТИПИЧНЫЕ ПРОБЛЕМЫ
- `mcopy` не может создать файл (нет места в FAT) → удали/замени крупный необязательный файл (`fake_data_spo2_3pd.dat` ~1 МБ) с бэкапом на хосте, либо уменьши свой файл (меньше секунд/частота).
- Изменения «пропали» → правил не тот образ (несколько копий моделей) или симулятор был запущен. Ориентируйся на дескрипторы живого QEMU (Шаг 0).
- Сенсор «не видит» данные → проверь: имя файла точное (`fake_data_compass.dat`), симулятор перезапущен полностью, приложение запрашивает нужную permission (`device:os.compass` и т.п. в app.json), API_LEVEL проекта ≥ требуемого (compass/acc — 3.0, barometer — 2.1).
- Файл на месте, но значения не меняются → проигрывание зациклилось на коротком файле: увеличь `--seconds`, чтобы цикл был реже.

## ФОРМАТ ОТЧЁТА
1. Путь к `<IMG>` и бэкапу; листинг `/virtual_sensor_data/` до и после.
2. По каждому сенсору: файл → параметры генерации → факт инъекции → лог проверки (первые 5 строк) → критерий (ДА/НЕТ/ЧАСТИЧНО с комментарием).
3. Компас — отдельным подразделом: скорость вращения в логе vs заданная (20°/с), время до калибровки (INVALID → угол), финальный вывод.
4. Список того, что НЕ удалось имитировать и почему (ALS — не поддерживается механизмом; ECG — нет в GTS 4; SpO₂/температура — если подбор не сошёлся).
5. Откаты/сбросы, если выполнялись.
