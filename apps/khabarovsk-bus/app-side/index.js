import { BaseSideService } from "@zeppos/zml/base-side";

const API_URL =
  "https://smarttransport.online/khabarovsk/php/apiRequest.php";
const TOKEN = "11111111-50b3-4fec-b922-8a50a1d38366";
const REGION = 27001;

const TYPE_NAMES = { 1: "А", 2: "Тб", 3: "Тм", 4: "Мт" };

function apiRequest(cmd, data) {
  const body = JSON.stringify({
    t: TOKEN,
    ct: 26,
    cd: cmd,
    reg: REGION,
    w: -1,
    data,
  });
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_URL + "?" + cmd, true);
    xhr.timeout = 12000;
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) {
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error("bad json"));
        }
      } else {
        reject(new Error("HTTP " + xhr.status));
      }
    };
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(body);
  });
}

function normalize(entry) {
  return {
    route: entry.routeShortName || TYPE_NAMES[entry.routeTypeId] || entry.routeNumber,
    number: entry.routeNumber,
    type: entry.routeTypeId,
    where: entry.whereGo || "",
    last: entry.lastStation || "",
    sec: entry.arrivalTimeInSec || 0,
    deviceCode: entry.deviceCode || "",
    routeId: entry.routeId || 0,
  };
}

function toRad(d) {
  return (d * Math.PI) / 180;
}

function haversine(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function loadVehicle(res, params) {
  try {
    const { deviceCode, routeId, lat, lng } = params || {};
    if (!deviceCode || !routeId) {
      res(null, { error: "no device" });
      return;
    }
    const vf = await apiRequest("getVehicleForecasts.php", {
      wuid: "",
      deviceCode,
    });
    const stopsF = (vf && vf.data) || [];
    if (!stopsF.length) {
      res(null, { error: "no forecast" });
      return;
    }
    const next = stopsF[0];

    const route = await apiRequest("getRouteById.php", { wuid: "", id: routeId });
    const subroutes = (route && route.data && route.data.subroutes) || [];
    let order = [];
    for (const sr of subroutes) {
      const stations = sr.stations || [];
      if (stations.some((s) => s.id === next.stid)) {
        order = stations;
        break;
      }
    }
    let prev = null;
    const idx = order.findIndex((s) => s.id === next.stid);
    if (idx > 0) {
      prev = order[idx - 1];
    } else if (idx === 0) {
      prev = next; // только начали маршрут
    }

    let speed = 8; // м/с, запасное значение
    if (stopsF.length >= 2 && stopsF[1]) {
      const d = haversine(
        { lat: next.lat, lng: next.lng },
        { lat: stopsF[1].lat, lng: stopsF[1].lng }
      );
      const dt = (stopsF[1].arrt || 0) - (next.arrt || 0);
      if (dt > 0 && d > 0) {
        speed = d / dt;
      }
    }

    const nextP = { lat: next.lat, lng: next.lng };
    const prevP = prev ? { lat: prev.lat, lng: prev.lng } : nextP;
    const segLen = haversine(prevP, nextP);
    let busDistToNext = (next.arrt || 0) * speed;
    if (busDistToNext > segLen) busDistToNext = segLen;
    let frac = segLen > 0 ? 1 - busDistToNext / segLen : 1;
    if (frac < 0) frac = 0;
    if (frac > 1) frac = 1;
    const bus = {
      lat: prevP.lat + (nextP.lat - prevP.lat) * frac,
      lng: prevP.lng + (nextP.lng - prevP.lng) * frac,
    };

    res(null, {
      prev: prev ? prev.name : "",
      next: next.stname || "",
      km: haversine({ lat: lat, lng: lng }, bus) / 1000,
      segKm: segLen / 1000,
    });
  } catch (e) {
    res(null, { error: String((e && e.message) || e) });
  }
}

async function loadForecast(res, sid) {
  try {
    const r = await apiRequest("getStationForecasts.php", {
      wuid: "",
      sid: Number(sid),
    });
    if (r.r !== "ok") {
      throw new Error(r.message || r.reason || "fail");
    }
    const list = (r.data || [])
      .map(normalize)
      .sort((a, b) => a.sec - b.sec)
      .slice(0, 12);
    res(null, { sid: Number(sid), list });
  } catch (e) {
    res(null, { error: String((e && e.message) || e) });
  }
}

async function nearestFor(sid) {
  try {
    const r = await apiRequest("getStationForecasts.php", {
      wuid: "",
      sid: Number(sid),
    });
    if (r.r !== "ok" || !r.data || !r.data.length) {
      return { sid, route: "", sec: null };
    }
    const first = r.data.slice().sort((a, b) => a.arrivalTimeInSec - b.arrivalTimeInSec)[0];
    return {
      sid,
      route: first.routeShortName || first.routeNumber,
      sec: first.arrivalTimeInSec || 0,
    };
  } catch (e) {
    return { sid, route: "", min: null };
  }
}

async function loadNearby(res, sids) {
  try {
    const items = [];
    for (const sid of sids || []) {
      items.push(await nearestFor(sid));
    }
    res(null, { items });
  } catch (e) {
    res(null, { error: String((e && e.message) || e) });
  }
}

AppSideService(
  BaseSideService({
    onInit() {},

    onRequest(req, res) {
      console.log("onRequest " + req.method + " params=" + JSON.stringify(req.params || {}));
      if (req.method === "GET_FORECAST") {
        loadForecast(res, req.params && req.params.sid);
      } else if (req.method === "GET_NEARBY") {
        loadNearby(res, (req.params && req.params.sids) || []);
      } else if (req.method === "GET_VEHICLE") {
        loadVehicle(res, req.params || {});
      }
    },

    onRun() {},

    onDestroy() {},
  })
);
