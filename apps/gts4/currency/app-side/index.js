import { BaseSideService } from "@zeppos/zml/base-side";

const CBR_URL = "https://www.cbr-xml-daily.ru/daily_json.js";
const ER_URL = "https://open.er-api.com/v6/latest/RUB";
const CURRENCIES = ["USD", "EUR", "CNY"];

async function readBody(res) {
  if (!res) {
    throw new Error("no response");
  }
  if (typeof res.text === "function") {
    return await res.text();
  }
  if (typeof res.body === "string") {
    return res.body;
  }
  if (res.body && typeof res.body === "object") {
    return JSON.stringify(res.body);
  }
  return String(res.body);
}

function viaFetch(url) {
  return fetch(url).then(readBody);
}

function viaFetchObject(url) {
  return fetch({ url, method: "GET" }).then(readBody);
}

function viaXhr(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.timeout = 6000;
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) {
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        reject(new Error("HTTP " + xhr.status));
      }
    };
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.onerror = () => reject(new Error("network error"));
    xhr.send();
  });
}

async function httpGet(url) {
  const errors = [];
  const strategies = [
    ["xhr", viaXhr],
    ["fetchStr", viaFetch],
    ["fetchObj", viaFetchObject],
  ];
  for (const [name, attempt] of strategies) {
    try {
      const text = await attempt(url);
      console.log("httpGet ok via " + name + " len=" + (text ? text.length : 0));
      if (text) {
        return text;
      }
    } catch (e) {
      const msg = String((e && e.message) || e);
      console.log("httpGet fail via " + name + ": " + msg);
      errors.push(name + ":" + msg);
    }
  }
  throw new Error(errors.join(" ; "));
}

async function getJson(url) {
  return JSON.parse(await httpGet(url));
}

async function fromCbr() {
  const body = await getJson(CBR_URL);
  const valute = (body && body.Valute) || {};
  return {
    source: "CBR",
    date: String((body && body.Date) || "").slice(0, 10),
    rates: CURRENCIES.filter((code) => valute[code]).map((code) => ({
      code,
      nominal: valute[code].Nominal,
      value: valute[code].Value,
    })),
  };
}

async function fromErApi() {
  const body = await getJson(ER_URL);
  const rates = (body && body.rates) || {};
  const date = new Date().toISOString().slice(0, 10);
  return {
    source: "ER-API",
    date,
    rates: CURRENCIES.filter((code) => rates[code]).map((code) => ({
      code,
      nominal: 1,
      value: 1 / rates[code],
    })),
  };
}

async function fetchRates(res) {
  let cbrErr = "";
  try {
    res(null, await fromCbr());
    return;
  } catch (e) {
    cbrErr = String((e && e.message) || e);
  }
  try {
    const data = await fromErApi();
    data.errorNote = "CBR: " + cbrErr;
    res(null, data);
  } catch (e) {
    res(null, {
      error: "CBR " + cbrErr + " | ER " + String((e && e.message) || e),
    });
  }
}

AppSideService(
  BaseSideService({
    onInit() {},

    onRequest(req, res) {
      if (req.method === "GET_RATES") {
        fetchRates(res);
      }
    },

    onRun() {},

    onDestroy() {},
  })
);
