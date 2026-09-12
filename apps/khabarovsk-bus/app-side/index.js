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
  };
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
      return { sid, route: "", min: null };
    }
    const first = r.data.slice().sort((a, b) => a.arrivalTimeInSec - b.arrivalTimeInSec)[0];
    return {
      sid,
      route: first.routeShortName || first.routeNumber,
      min: Math.max(0, Math.round((first.arrivalTimeInSec || 0) / 60)),
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
      }
    },

    onRun() {},

    onDestroy() {},
  })
);
