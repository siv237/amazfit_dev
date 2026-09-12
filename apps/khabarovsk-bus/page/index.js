import * as hmUI from "@zos/ui";
import { log as Logger } from "@zos/utils";
import { BasePage } from "@zeppos/zml/base-page";
import { Time } from "@zos/sensor";
import { STATIONS } from "./stations.js";

const logger = Logger.getLogger("khv-bus");
const time = new Time();

const W = 390;
const TOP = 60; // под системный статус-бар
const BAND_H = 46;
const C = {
  band: 0x1f6fe0,
  bandText: 0xffffff,
  bandSub: 0xd7e6ff,
  card: 0x1c1c1e,
  row: 0x141417,
  text: 0xffffff,
  muted: 0x9aa0a6,
  green: 0x2ecc71,
  accent: 0x2d7ff9,
};

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

const NEAREST_N = 5;
const DEFAULT_POS = { lat: 48.5000302, lng: 135.0979337 };

let widgets = [];
let clockWidget = null;
let clockTimer = null;
let stops = [];
let summaries = {};
let mode = "list";
let currentIndex = 0;
let currentArrivals = [];
let currentArrivalsSid = 0;

function currentPosition() {
  return DEFAULT_POS;
}

function iconFor(type) {
  if (type === 2) return "trolley.png";
  if (type === 3) return "minibus.png";
  if (type === 4) return "tram.png";
  return "bus.png";
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
  return name.length > 20 ? name.slice(0, 19) + "…" : name;
}

function shortDir(station) {
  const d = (station[2] || "").replace("в сторону ", "к ").replace("в стор. ", "к ");
  return d.length > 18 ? d.slice(0, 17) + "…" : d;
}

function distLabel(station) {
  const d = Math.round(distanceMeters(DEFAULT_POS.lat, DEFAULT_POS.lng, station));
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
      stops = nearestStations(DEFAULT_POS.lat, DEFAULT_POS.lng, NEAREST_N);
      this.renderList();
      this.loadNearby();
      clockTimer = setInterval(() => {
        if (clockWidget) {
          clockWidget.setProperty(hmUI.prop.TEXT, clockText());
        }
      }, 1000);
    },

    onDestroy() {
      if (clockTimer) {
        clearInterval(clockTimer);
        clockTimer = null;
      }
    },

    add(widget) {
      widgets.push(widget);
      return widget;
    },

    clear() {
      widgets.forEach((w) => hmUI.deleteWidget(w));
      widgets = [];
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
      const h = subtitle ? 62 : BAND_H;
      const titleY = subtitle ? 4 : 7;
      // Кнопка-подложка на всю шапку: тап в любое место = назад.
      this.add(
        hmUI.createWidget(hmUI.widget.BUTTON, {
          x: 0, y: 0, w: W, h,
          normal_color: C.band, press_color: C.band,
          color: C.band, text: "",
          click_func: () => {
            if (onBack) onBack();
          },
        })
      );
      if (onBack) {
        this.text(14, titleY, 28, 30, "‹", 30, C.bandText);
        this.text(54, titleY, W - 140, 30, title, 25, C.bandText, hmUI.align.LEFT);
      } else {
        this.add(hmUI.createWidget(hmUI.widget.IMG, { x: 14, y: 7, w: 32, h: 32, src: "bus.png", click_func: () => {} }));
        this.text(54, 7, W - 140, 32, title, 27, C.bandText);
      }
      if (subtitle) {
        this.text(54, 33, W - 148, 24, subtitle, 17, C.bandSub);
      }
      clockWidget = this.text(
        W - 124, titleY + 2, 112, 30, clockText(), 22, C.bandSub, hmUI.align.RIGHT
      );
    },

    row(y, iconSrc, name, dir, etaText, etaColor, distText, onTap) {
      const g = hmUI.createWidget(hmUI.widget.GROUP, {
        x: 10, y, w: W - 20, h: 54, click_func: onTap,
      });
      widgets.push(g);
      const t = (x, yy, w, h, text, size, color, align) =>
        g.createWidget(hmUI.widget.TEXT, {
          x, y: yy, w, h, color, text_size: size,
          align_h: align || hmUI.align.LEFT, align_v: hmUI.align.CENTER_V, text,
          click_func: onTap,
        });
      g.createWidget(hmUI.widget.FILL_RECT, {
        x: 0, y: 0, w: W - 20, h: 54, radius: 14, color: C.card, click_func: onTap,
      });
      g.createWidget(hmUI.widget.IMG, { x: 12, y: 11, w: 32, h: 32, src: iconSrc, click_func: onTap });
      t(54, 5, W - 186, 24, name, 20, C.text);
      t(54, 29, W - 186, 20, dir, 15, C.muted);
      t(W - 122, 5, 68, 24, etaText, 20, etaColor, hmUI.align.RIGHT);
      t(W - 122, 29, 68, 20, distText, 14, C.muted, hmUI.align.RIGHT);
      t(W - 48, 5, 20, 44, "›", 22, C.muted, hmUI.align.CENTER_H);
    },

    renderList() {
      mode = "list";
      this.clear();
      this.text(18, BAND_H + 4, W - 36, 22, "Ближайшие остановки", 16, C.muted);

      const data = stops.map((station) => {
        const s = summaries[station[0]];
        return {
          name: shortName(station),
          dir: shortDir(station),
          eta: s && s.route ? `${s.route} ${s.min}м` : s ? "нет" : "…",
          dist: distLabel(station),
          icon: "bus.png",
        };
      });

      this.add(
        hmUI.createWidget(hmUI.widget.SCROLL_LIST, {
          x: 20,
          y: BAND_H + 32,
          w: W - 40,
          h: 356,
          item_height: 64,
          item_space: 6,
          item_config: [
            {
              type_id: 1,
              item_bg_color: C.card,
              item_bg_radius: 16,
              text_view: [
                { x: 58, y: 4, w: 172, h: 28, key: "name", color: C.text, text_size: 23, align_h: hmUI.align.LEFT },
                { x: 58, y: 34, w: 172, h: 24, key: "dir", color: C.muted, text_size: 16, align_h: hmUI.align.LEFT },
                { x: 228, y: 4, w: 104, h: 28, key: "eta", color: C.green, text_size: 23, align_h: hmUI.align.RIGHT },
                { x: 228, y: 34, w: 104, h: 24, key: "dist", color: C.muted, text_size: 16, align_h: hmUI.align.RIGHT },
              ],
              text_view_count: 4,
              image_view: [
                { x: 8, y: 16, w: 34, h: 34, key: "icon" },
              ],
              image_view_count: 1,
              item_height: 64,
            },
          ],
          item_config_count: 1,
          data_array: data,
          data_count: data.length,
          data_type_config: [{ start: 0, end: data.length, type_id: 1 }],
          data_type_config_count: 1,
          item_click_func: (w, index) => {
            currentIndex = index;
            this.renderDetail(index);
          },
        })
      );

      this.header("Автобусы", null);
    },

    renderDetail(index) {
      mode = "detail";
      currentIndex = index;
      const station = stops[index];
      if (currentArrivalsSid !== station[0]) {
        currentArrivals = [];
        currentArrivalsSid = station[0];
        this.loadDetails(station[0]);
      }
      this.clear();

      const top = 70;
      this.text(18, top, W - 36, 20, "Ближайшие автобусы", 16, C.muted);

      if (!currentArrivals.length) {
        this.text(18, top + 34, W - 36, 24, "Загрузка...", 20, C.muted);
      } else {
        const data = currentArrivals.slice(0, 5).map((a) => ({
          route: a.route,
          eta: `${Math.max(0, a.min)} мин`,
          icon: iconFor(a.type),
        }));
        this.add(
          hmUI.createWidget(hmUI.widget.SCROLL_LIST, {
            x: 20, y: top + 26, w: W - 40, h: 330,
            item_height: 60, item_space: 6,
            item_config: [
              {
                type_id: 1,
                item_bg_color: C.card,
                item_bg_radius: 14,
                text_view: [
                  { x: 58, y: 4, w: 176, h: 52, key: "route", color: C.text, text_size: 23, align_h: hmUI.align.LEFT },
                  { x: 228, y: 4, w: 104, h: 52, key: "eta", color: C.green, text_size: 23, align_h: hmUI.align.RIGHT },
                ],
                text_view_count: 2,
                image_view: [{ x: 8, y: 13, w: 34, h: 34, key: "icon" }],
                image_view_count: 1,
                item_height: 60,
              },
            ],
            item_config_count: 1,
            data_array: data,
            data_count: data.length,
            data_type_config: [{ start: 0, end: data.length, type_id: 1 }],
            data_type_config_count: 1,
            item_click_func: (w, index) => this.renderBus(index),
          })
        );
      }

      this.header(
        station[1], () => this.renderList(),
        `${shortDir(station)} · ${distLabel(station)}`
      );
    },

    renderBus(index) {
      mode = "bus";
      const a = currentArrivals[index];
      if (!a) {
        return;
      }
      this.clear();

      let next = null;
      for (let i = index + 1; i < currentArrivals.length; i++) {
        if (currentArrivals[i].route === a.route) {
          next = currentArrivals[i];
          break;
        }
      }

      const mins = Math.max(0, a.min);

      this.text(0, 96, W, 150, String(mins), 150, C.green, hmUI.align.CENTER_H, hmUI.align.CENTER_V);
      this.text(0, 232, W, 30, "минут до прибытия", 20, C.muted, hmUI.align.CENTER_H);

      this.add(
        hmUI.createWidget(hmUI.widget.FILL_RECT, {
          x: 24, y: 286, w: W - 48, h: 92, radius: 18, color: C.card,
        })
      );
      this.text(40, 300, W - 80, 24, "Следующий рейс", 16, C.muted);
      if (next) {
        this.text(
          40, 326, W - 80, 40, `через ${Math.max(0, next.min)} мин`, 28, C.text
        );
      } else {
        this.text(40, 326, W - 80, 40, "больше нет данных", 20, C.muted);
      }

      this.header(a.route, () => this.renderDetail(currentIndex));
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
          if (mode === "list") {
            this.renderList();
          }
        })
        .catch(() => {
          if (n < 40) {
            setTimeout(() => this.loadNearby(n + 1), 2500);
          }
        });
    },

    loadDetails(sid, attempt) {
      const n = attempt || 0;
      this.request({ method: "GET_FORECAST", params: { sid } })
        .then((data) => {
          currentArrivals = (data && data.list ? data.list : []).map((x) => ({
            route: x.route,
            type: x.type,
            min: Math.max(0, Math.round((x.sec || 0) / 60)),
          }));
          if (mode === "detail" && this.currentStationId() === sid) {
            this.renderDetail(currentIndex);
          }
        })
        .catch(() => {
          if (n < 20) {
            setTimeout(() => this.loadDetails(sid, n + 1), 2000);
          }
        });
    },
  })
);
