import * as hmUI from "@zos/ui";
import { Geolocation, Accelerometer, Gyroscope, Compass, Barometer, hmSensor } from "@zos/sensor";

const W = 390;
const C = {
  band: 0x1f6fe0,
  text: 0xffffff,
  green: 0x2ecc71,
  muted: 0x9aa0a6,
  red: 0xe53935,
  yellow: 0xffb300,
};

let geo = null;
let acc = null;
let gyro = null;
let comp = null;
let baro = null;
let timer = null;
let updates = 0;
let w = {};

function txt(props) {
  return hmUI.createWidget(hmUI.widget.TEXT, props);
}

function fmt(v, n) {
  if (typeof v === "number") return v.toFixed(n == null ? 5 : n);
  return String(v);
}

function dmsStr(d) {
  if (!d || typeof d !== "object") return "?";
  return `${d.degrees}°${d.minutes}'${d.seconds.toFixed(1)}"${d.direction}`;
}

function tryStart(name, make) {
  try {
    const s = make();
    if (s.start) s.start();
    return s;
  } catch (e) {
    console.log("SENSOR " + name + " start error: " + e);
    return null;
  }
}

Page({
  build() {
    try {
      hmUI.setStatusBarVisible(false);
    } catch (e) {
      console.log("statusbar: " + e);
    }

    hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: W, h: 52, color: C.band });
    txt({
      x: 0, y: 10, w: W, h: 32, text: "GPS / Sensors",
      color: C.text, text_size: 24, align_h: hmUI.align.CENTER_H,
    });

    w.status = txt({ x: 16, y: 60, w: W - 32, h: 28, text: "GPS: …", color: C.text, text_size: 20, align_h: hmUI.align.LEFT });
    w.lat = txt({ x: 16, y: 92, w: W - 32, h: 30, text: "lat: …", color: C.green, text_size: 22, align_h: hmUI.align.LEFT });
    w.lng = txt({ x: 16, y: 126, w: W - 32, h: 30, text: "lng: …", color: C.green, text_size: 22, align_h: hmUI.align.LEFT });
    w.dms = txt({ x: 16, y: 158, w: W - 32, h: 44, text: "", color: C.muted, text_size: 15, align_h: hmUI.align.LEFT });

    w.acc = txt({ x: 16, y: 212, w: W - 32, h: 24, text: "acc: …", color: C.yellow, text_size: 16, align_h: hmUI.align.LEFT });
    w.gyro = txt({ x: 16, y: 238, w: W - 32, h: 24, text: "gyro: …", color: C.yellow, text_size: 16, align_h: hmUI.align.LEFT });
    w.comp = txt({ x: 16, y: 264, w: W - 32, h: 24, text: "cmp: …", color: C.yellow, text_size: 16, align_h: hmUI.align.LEFT });
    w.baro = txt({ x: 16, y: 290, w: W - 32, h: 24, text: "bar: …", color: C.yellow, text_size: 16, align_h: hmUI.align.LEFT });
    w.info = txt({ x: 16, y: 410, w: W - 32, h: 24, text: "updates: 0", color: C.muted, text_size: 15, align_h: hmUI.align.LEFT });

    geo = tryStart("geo", () => {
      const g = new Geolocation();
      g.onChange(() => this.refresh());
      return g;
    });
    acc = tryStart("acc", () => new Accelerometer());
    gyro = tryStart("gyro", () => new Gyroscope());
    comp = tryStart("comp", () => new Compass());
    baro = tryStart("baro", () => new Barometer());

    console.log("SENSORS geolocation=" + (geo ? "on" : "off") + " acc=" + (acc ? "on" : "off") + " gyro=" + (gyro ? "on" : "off") + " compass=" + (comp ? "on" : "off") + " baro=" + (baro ? "on" : "off"));

    // Probe the legacy hmSensor API (may expose the sport/GPS pipeline).
    try {
      console.log("HMSENSOR present=" + (typeof hmSensor) + " ids=" + JSON.stringify(hmSensor && hmSensor.id));
      const ids = (hmSensor && hmSensor.id) || {};
      ["GEOLOCATION", "GPS", "LOCATION"].forEach((k) => {
        if (ids[k] == null) return;
        try {
          const s = hmSensor.createSensor(ids[k]);
          if (s.start) s.start();
          const lat = s.getLatitude ? s.getLatitude() : "n/a";
          const lng = s.getLongitude ? s.getLongitude() : "n/a";
          console.log("HMSENSOR " + k + " lat=" + lat + " lng=" + lng);
          if (w.info) w.info.setProperty(hmUI.prop.TEXT, "legacy " + k + ": " + lat + "," + lng);
        } catch (e) {
          console.log("HMSENSOR " + k + " error: " + e);
        }
      });
    } catch (e) {
      console.log("HMSENSOR probe error: " + e);
    }
    this.refresh();
    timer = setInterval(() => this.refresh(), 1000);
  },

  refresh() {
    updates++;
    try {
      if (geo) {
        const st = geo.getStatus();
        const lat = geo.getLatitude({ format: "DD" });
        const lng = geo.getLongitude({ format: "DD" });
        const latD = geo.getLatitude({ format: "DMS" });
        const lngD = geo.getLongitude({ format: "DMS" });
        if (w.status) {
          w.status.setProperty(hmUI.prop.TEXT, "GPS status: " + st + "  (" + updates + ")");
          w.status.setProperty(hmUI.prop.COLOR, st === "A" ? C.green : C.red);
        }
        if (w.lat) w.lat.setProperty(hmUI.prop.TEXT, "lat: " + fmt(lat));
        if (w.lng) w.lng.setProperty(hmUI.prop.TEXT, "lng: " + fmt(lng));
        if (w.dms) w.dms.setProperty(hmUI.prop.TEXT, dmsStr(latD) + "\n" + dmsStr(lngD));
        console.log("GPSTEST " + st + " lat=" + lat + " lng=" + lng);
      }
    } catch (e) {
      console.log("GPSTEST err: " + e);
    }

    try {
      if (w.acc && acc) w.acc.setProperty(hmUI.prop.TEXT, `acc: ${acc.getX()}, ${acc.getY()}, ${acc.getZ()}`);
    } catch (e) { if (w.acc) w.acc.setProperty(hmUI.prop.TEXT, "acc: err"); }
    try {
      if (w.gyro && gyro) w.gyro.setProperty(hmUI.prop.TEXT, `gyro: ${gyro.getX()}, ${gyro.getY()}, ${gyro.getZ()}`);
    } catch (e) { if (w.gyro) w.gyro.setProperty(hmUI.prop.TEXT, "gyro: err"); }
    try {
      if (w.comp && comp) w.comp.setProperty(hmUI.prop.TEXT, `cmp: dir=${comp.getDirection()} angle=${comp.getDirectionAngle()} st=${comp.getStatus()}`);
    } catch (e) { if (w.comp) w.comp.setProperty(hmUI.prop.TEXT, "cmp: err " + e); }
    try {
      if (w.baro && baro) w.baro.setProperty(hmUI.prop.TEXT, `bar: ${baro.getAirPressure()} Pa`);
    } catch (e) { if (w.baro) w.baro.setProperty(hmUI.prop.TEXT, "bar: err"); }
    if (w.info) w.info.setProperty(hmUI.prop.TEXT, "updates: " + updates);
  },

  onDestroy() {
    if (timer) clearInterval(timer);
    timer = null;
    [geo, acc, gyro, comp, baro].forEach((s) => {
      if (s && s.stop) {
        try { s.stop(); } catch (e) { /* ignore */ }
      }
    });
  },
});
