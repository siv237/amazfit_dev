import * as hmUI from "@zos/ui";
import { log as Logger } from "@zos/utils";
import { Time, Geolocation } from "@zos/sensor";
import { BasePage } from "@zeppos/zml/base-page";
import { STATIONS } from "./stations.js";

const logger = Logger.getLogger("khv-bus");
const time = new Time();

const W = 390;
const BAND_H = 50;
const NEAREST_N = 5;
const DEFAULT_POS = { lat: 48.4827, lng: 135.0838 };

const C = {
  band: 0x1f6fe0,
  bandText: 0xffffff,
  bandSub: 0xd7e6ff,
  card: 0x1c1c1e,
  text: 0xffffff,
  muted: 0x9aa0a6,
  green: 0x2ecc71,
  red: 0xe53935,
  accent: 0x2d7ff9,
};

const ITEM_CFG = {
  type_id: 1,
  item_bg_color: C.card,
  item_bg_radius: 14,
  text_view: [
    { x: 54, y: 2, w: 150, h: 26, key: "name", color: C.text, text_size: 23, align_h: hmUI.align.LEFT },
    { x: 54, y: 28, w: 150, h: 22, key: "dir", color: C.muted, text_size: 16, align_h: hmUI.align.LEFT },
    { x: 196, y: 2, w: 104, h: 26, key: "eta", color: C.green, text_size: 23, align_h: hmUI.align.RIGHT },
    { x: 196, y: 28, w: 104, h: 22, key: "dist", color: C.muted, text_size: 16, align_h: hmUI.align.RIGHT },
  ],
  text_view_count: 4,
  image_view: [{ x: 8, y: 16, w: 34, h: 34, key: "icon" }],
  image_view_count: 1,
  item_height: 58,
};

const ARRIVAL_CFG = {
  type_id: 1,
  item_bg_color: C.card,
  item_bg_radius: 14,
  text_view: [
    { x: 54, y: 4, w: 150, h: 52, key: "route", color: C.text, text_size: 23, align_h: hmUI.align.LEFT },
    { x: 196, y: 4, w: 104, h: 52, key: "eta", color: C.green, text_size: 23, align_h: hmUI.align.RIGHT },
  ],
  text_view_count: 2,
  image_view: [{ x: 8, y: 13, w: 34, h: 34, key: "icon" }],
  image_view_count: 1,
  item_height: 60,
};

let widgets = [];
let clockWidget = null;
let clockTimer = null;
let refreshTimer = null;
let listWidget = null;
let listKind = "";
let busNumberWidget = null;
let vehicleWidget = null;
let vehicleKmWidget = null;
let statusWidget = null;
let lastOk = 0;
let firstLoadAt = 0;
let geoPos = null;
let geolocation = null;
let geoCallback = null;
let providerTimer = null;
let busA = null;
let stops = [];
let summaries = {};
let arrivalsCache = {};
let nearbyAt = 0;
let arrivalsAt = 0;
let mode = "list";
let currentIndex = 0;
let currentArrivals = [];
let currentArrivalsSid = 0;

function pad(n) {
  return n < 10 ? "0" + n : String(n);
}

function clockText() {
  try {
    return `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  } catch (e) {
    return "";
  }
}

function currentPosition() {
  return geoPos || DEFAULT_POS;
}

function iconFor(type) {
  if (type === 2) return "trolley.png";
  if (type === 3) return "minibus.png";
  if (type === 4) return "tram.png";
  return "bus.png";
}

function mins(sec, at) {
  if (sec == null) return null;
  const left = sec - (Date.now() - at) / 1000;
  return Math.max(0, Math.ceil(left / 60));
}

function distanceMeters(lat, lng, station) {
  const dLat = (station[3] - lat) * 111320;
  const dLng = (station[4] - lng) * 111320 * Math.cos((lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function nearestStations(lat, lng, n) {
  return STATIONS.slice()
    .sort((a, b) => distanceMeters(lat, lng, a) - distanceMeters(lat, lng, b))
    .slice(0, n);
}

function shortName(station) {
  const name = station[1];
  return name.length > 18 ? name.slice(0, 17) + "…" : name;
}

function shortDir(station) {
  const d = (station[2] || "").replace("в сторону ", "к ").replace("в стор. ", "к ");
  return d.length > 18 ? d.slice(0, 17) + "…" : d;
}

function distLabel(station) {
  const pos = currentPosition();
  const d = Math.round(distanceMeters(pos.lat, pos.lng, station));
  return d < 1000 ? `${d} м` : `${(d / 1000).toFixed(1)} км`;
}

Page(
  BasePage({
    state: {},

    build() {
      try {
        hmUI.setStatusBarVisible(false);
      } catch (e) {
        logger.log("status bar: " + e);
      }
      const pos0 = currentPosition();
      stops = nearestStations(pos0.lat, pos0.lng, NEAREST_N);
      firstLoadAt = Date.now();
      this.renderList();
      this.loadNearby();
      this.startGeolocation();
      this.startProvider();
      clockTimer = setInterval(() => this.tick(), 1000);
      refreshTimer = setInterval(() => {
        if (mode === "list") {
          this.loadNearby();
        } else {
          const sid = this.currentStationId();
          if (sid) this.loadDetails(sid);
        }
      }, 30000);
    },

    onDestroy() {
      if (clockTimer) clearInterval(clockTimer);
      if (refreshTimer) clearInterval(refreshTimer);
      clockTimer = null;
      refreshTimer = null;
      if (providerTimer) clearInterval(providerTimer);
      providerTimer = null;
      if (geolocation && geoCallback) {
        try {
          geolocation.offChange(geoCallback);
          geolocation.stop();
        } catch (e) {
          logger.log("geo stop: " + e);
        }
      }
    },

    startGeolocation() {
      try {
        geolocation = new Geolocation();
        geoCallback = () => this.onGeolocation();
        geolocation.start();
        geolocation.onChange(geoCallback);
        this.onGeolocation();
      } catch (e) {
        logger.log("geo start: " + e);
      }
    },

    // Position from the companion (app-side). On a real watch this is the
    // GNSS/assisted position; in the simulator the host returns a test point.
    startProvider() {
      this.pollProvider();
      if (providerTimer) clearInterval(providerTimer);
      providerTimer = setInterval(() => this.pollProvider(), 3000);
    },

    pollProvider() {
      try {
        this.request({ method: "GET_POSITION" })
          .then((data) => {
            if (data && typeof data.lat === "number" && typeof data.lng === "number") {
              this.applyPosition(data.lat, data.lng, "provider");
            }
          })
          .catch(() => {});
      } catch (e) {
        logger.log("provider: " + e);
      }
    },

    applyPosition(lat, lng, source) {
      const prev = geoPos;
      const moved = !prev ||
        distanceMeters(lat, lng, [0, "", "", prev.lat, prev.lng]) > 10;
      if (!moved) return;
      geoPos = { lat, lng };
      logger.log("pos[" + source + "] " + lat.toFixed(5) + "," + lng.toFixed(5));
      if (mode === "list") {
        stops = nearestStations(lat, lng, NEAREST_N);
        this.renderList();
        this.loadNearby();
      }
    },

    onGeolocation() {
      try {
        if (!geolocation || geolocation.getStatus() !== "A") return;
        const lat = geolocation.getLatitude({ format: "DD" });
        const lng = geolocation.getLongitude({ format: "DD" });
        if (typeof lat !== "number" || typeof lng !== "number") return;
        // Only trust coordinates around Khabarovsk; the simulator currently
        // reports a fixed location far away, so the provider is used there.
        if (lat < 47.5 || lat > 49.2 || lng < 134.0 || lng > 136.5) {
          return;
        }
        this.applyPosition(lat, lng, "gnss");
      } catch (e) {
        logger.log("geo cb: " + e);
      }
    },

    tick() {
      if (clockWidget) {
        clockWidget.setProperty(hmUI.prop.TEXT, clockText());
      }
      if (statusWidget) {
        const age = lastOk ? (Date.now() - lastOk) / 1000 : 0;
        statusWidget.setProperty(hmUI.prop.TEXT, this.statusText());
        statusWidget.setProperty(hmUI.prop.COLOR, this.statusColor(age));
      }
      if (mode === "bus") {
        if (busNumberWidget && busA) {
          busNumberWidget.setProperty(hmUI.prop.TEXT, String(mins(busA.sec, arrivalsAt)));
        }
        return;
      }
      if (!listWidget) return;
      const data = mode === "list" ? this.listData() : this.detailData();
      listWidget.setProperty(hmUI.prop.UPDATE_DATA, {
        data_array: data,
        data_count: data.length,
        data_type_config: [{ start: 0, end: data.length, type_id: 1 }],
        data_type_config_count: 1,
        on_page: 1,
      });
    },

    add(widget) {
      widgets.push(widget);
      return widget;
    },

    clear() {
      widgets.forEach((w) => hmUI.deleteWidget(w));
      widgets = [];
      listWidget = null;
      busNumberWidget = null;
      vehicleWidget = null;
      vehicleKmWidget = null;
      statusWidget = null;
    },

    statusColor(age) {
      if (!lastOk) {
        return Date.now() - firstLoadAt > 5000 ? C.red : C.muted;
      }
      if (age > 120) return 0xe53935;
      if (age > 30) return 0xffb300;
      return C.muted;
    },

    statusText() {
      if (!lastOk) {
        return Date.now() - firstLoadAt > 5000
          ? "обновление не удалось"
          : "загрузка…";
      }
      const age = Math.round((Date.now() - lastOk) / 1000);
      return `обновлено ${age} с назад`;
    },

    statusLine() {
      statusWidget = this.text(
        34, 392, W - 68, 22, this.statusText(), 15, this.statusColor(
          lastOk ? (Date.now() - lastOk) / 1000 : 0
        ),
        hmUI.align.LEFT
      );
    },

    text(x, y, w, h, text, size, color, align, alignV) {
      return this.add(
        hmUI.createWidget(hmUI.widget.TEXT, {
          x, y, w, h, color, text_size: size,
          align_h: align || hmUI.align.LEFT,
          align_v: alignV || hmUI.align.CENTER_V,
          text,
        })
      );
    },

    header(title, onBack, subtitle) {
      const h = subtitle ? 64 : 50;
      const titleY = subtitle ? 8 : 14;
      const back = () => {
        if (onBack) onBack();
      };
      this.add(hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: W, h, color: C.band }));
      const headBtn = (x, y, w, hh, text, size, align, color) =>
        this.add(
          hmUI.createWidget(hmUI.widget.BUTTON, {
            x, y, w, h: hh, radius: 0,
            normal_color: C.band, press_color: C.band,
            color: color || C.bandText, text, text_size: size,
            align_h: align || hmUI.align.LEFT,
            click_func: back,
          })
        );
      if (onBack) {
        headBtn(32, titleY, 28, 30, "‹", 30, hmUI.align.CENTER_H);
        headBtn(74, titleY, W - 226, 30, title, 25, hmUI.align.LEFT);
        if (subtitle) headBtn(74, 36, W - 226, 24, subtitle, 17, hmUI.align.LEFT, C.bandSub);
      } else {
        this.add(hmUI.createWidget(hmUI.widget.IMG, { x: 32, y: 15, w: 30, h: 30, src: "bus.png" }));
        this.text(74, 14, W - 226, 32, title, 27, C.bandText);
      }
      clockWidget = headBtn(
        W - 152, titleY + 1, 112, 30, clockText(), 22, hmUI.align.RIGHT, C.bandSub
      );
    },

    listData() {
      return stops.map((station) => {
        const s = summaries[station[0]];
        const m = s ? mins(s.sec, nearbyAt) : null;
        return {
          name: shortName(station),
          dir: shortDir(station),
          eta: s && s.route ? (m == null ? "нет" : `${s.route} ${m}м`) : s ? "нет" : "…",
          dist: distLabel(station),
          icon: "bus.png",
        };
      });
    },

    detailData() {
      return currentArrivals.map((a) => ({
        route: a.route,
        eta: `${mins(a.sec, arrivalsAt)} мин`,
        icon: iconFor(a.type),
      }));
    },

    renderList() {
      mode = "list";
      this.clear();
      this.text(34, BAND_H + 6, W - 68, 22, "Ближайшие остановки", 16, C.muted);
      const data = this.listData();
      listWidget = this.add(
        hmUI.createWidget(hmUI.widget.SCROLL_LIST, {
          x: 26, y: BAND_H + 28, w: W - 52, h: 312,
          item_height: 58, item_space: 4,
          item_config: [ITEM_CFG], item_config_count: 1,
          data_array: data, data_count: data.length,
          data_type_config: [{ start: 0, end: data.length, type_id: 1 }],
          data_type_config_count: 1,
          item_click_func: (w, index) => {
            currentIndex = index;
            this.renderDetail(index);
          },
        })
      );
      listKind = "list";
      this.statusLine();
      this.header("Автобусы", null);
    },

    renderDetail(index) {
      mode = "detail";
      currentIndex = index;
      const station = stops[index];
      const sid = station[0];
      if (currentArrivalsSid !== sid) {
        currentArrivalsSid = sid;
        if (arrivalsCache[sid]) {
          currentArrivals = arrivalsCache[sid].list;
          arrivalsAt = arrivalsCache[sid].at;
        } else {
          currentArrivals = [];
        }
        this.loadDetails(sid);
      }
      this.clear();

      const top = 70;
      this.text(34, top, W - 68, 20, "Ближайшие автобусы", 16, C.muted);

      if (!currentArrivals.length) {
        this.text(34, top + 34, W - 68, 24, "Загрузка...", 20, C.muted);
      } else {
        const data = this.detailData();
        listWidget = this.add(
          hmUI.createWidget(hmUI.widget.SCROLL_LIST, {
            x: 26, y: top + 26, w: W - 52, h: 264,
            item_height: 60, item_space: 6,
            item_config: [ARRIVAL_CFG], item_config_count: 1,
            data_array: data, data_count: data.length,
            data_type_config: [{ start: 0, end: data.length, type_id: 1 }],
            data_type_config_count: 1,
            item_click_func: (w, idx) => this.renderBus(idx),
          })
        );
      }
      listKind = "detail";
      this.statusLine();
      this.header(
        station[1], () => this.renderList(),
        `${shortDir(station)} · ${distLabel(station)}`
      );
    },

    renderBus(index) {
      mode = "bus";
      busA = currentArrivals[index] || null;
      if (!busA) return;
      this.clear();

      const num = mins(busA.sec, arrivalsAt);
      busNumberWidget = this.text(
        0, 52, W, 122, String(num), 116, C.green,
        hmUI.align.CENTER_H, hmUI.align.CENTER_V
      );
      this.text(0, 176, W, 24, "минут до прибытия", 18, C.muted, hmUI.align.CENTER_H);

      this.add(
        hmUI.createWidget(hmUI.widget.FILL_RECT, {
          x: 32, y: 208, w: W - 64, h: 176, radius: 18, color: C.card,
        })
      );
      this.text(48, 220, W - 96, 22, "Следующий рейс", 14, C.muted);

      let next = null;
      for (let i = index + 1; i < currentArrivals.length; i++) {
        if (currentArrivals[i].route === busA.route) {
          next = currentArrivals[i];
          break;
        }
      }
      if (next) {
        this.text(48, 240, W - 96, 32, `через ${mins(next.sec, arrivalsAt)} мин`, 26, C.text);
      } else {
        this.text(48, 242, W - 96, 30, "больше нет данных", 18, C.muted);
      }

      this.text(48, 278, W - 96, 22, "Сейчас между остановками", 14, C.muted);
      vehicleWidget = this.add(
        hmUI.createWidget(hmUI.widget.TEXT, {
          x: 48, y: 300, w: W - 96, h: 48, color: C.text, text_size: 16,
          align_h: hmUI.align.LEFT, align_v: hmUI.align.TOP,
          text_style: hmUI.text_style.WRAP, text: "…",
        })
      );
      vehicleKmWidget = this.text(48, 350, W - 96, 26, "", 17, C.green);

      this.statusLine();
      const station = stops[currentIndex];
      this.header(
        `${busA.route} · ${station ? shortName(station) : ""}`,
        () => this.renderDetail(currentIndex)
      );

      this.loadVehicle();
    },

    loadVehicle() {
      const station = stops[currentIndex];
      if (!station) return;
      const none = () => {
        if (vehicleWidget) vehicleWidget.setProperty(hmUI.prop.TEXT, "нет данных");
        if (vehicleKmWidget) vehicleKmWidget.setProperty(hmUI.prop.TEXT, "");
      };
      if (!busA || !busA.deviceCode) {
        none();
        return;
      }
      this.request({
        method: "GET_VEHICLE",
        params: {
          deviceCode: busA.deviceCode,
          routeId: busA.routeId,
          lat: station[3],
          lng: station[4],
        },
      })
        .then((data) => {
          if (!vehicleWidget) return;
          if (!data || data.error) {
            none();
            return;
          }
          vehicleWidget.setProperty(
            hmUI.prop.TEXT, `${data.prev || "?"} → ${data.next || "?"}`
          );
          if (vehicleKmWidget) {
            vehicleKmWidget.setProperty(
              hmUI.prop.TEXT,
              data.km == null ? "" : `≈ ${data.km.toFixed(1)} км до остановки`
            );
          }
        })
        .catch(none);
    },

    currentStationId() {
      return stops[currentIndex] ? stops[currentIndex][0] : 0;
    },

    loadNearby(attempt) {
      const n = attempt || 0;
      this.request({
        method: "GET_NEARBY",
        params: { sids: stops.map((s) => s[0]) },
      })
        .then((data) => {
          const items = (data && data.items) || [];
          if (!items.length && n < 40) {
            setTimeout(() => this.loadNearby(n + 1), 2500);
            return;
          }
          summaries = {};
          items.forEach((it) => {
            summaries[it.sid] = it;
          });
          nearbyAt = Date.now();
          lastOk = Date.now();
          if (mode === "list") this.renderList();
        })
        .catch(() => {
          if (n < 40) setTimeout(() => this.loadNearby(n + 1), 2500);
        });
    },

    loadDetails(sid, attempt) {
      const n = attempt || 0;
      this.request({ method: "GET_FORECAST", params: { sid } })
        .then((data) => {
          currentArrivals = (data && data.list ? data.list : []).map((x) => ({
            route: x.route,
            type: x.type,
            sec: x.sec,
            deviceCode: x.deviceCode,
            routeId: x.routeId,
          }));
          arrivalsAt = Date.now();
          lastOk = Date.now();
          arrivalsCache[sid] = { list: currentArrivals, at: arrivalsAt };
          if (mode === "detail" && this.currentStationId() === sid) {
            this.renderDetail(currentIndex);
          } else if (mode === "bus" && this.currentStationId() === sid && busA) {
            const idx = currentArrivals.findIndex((x) => x.route === busA.route);
            if (idx >= 0) this.renderBus(idx);
          }
        })
        .catch(() => {
          if (n < 20) setTimeout(() => this.loadDetails(sid, n + 1), 2000);
        });
    },
  })
);
