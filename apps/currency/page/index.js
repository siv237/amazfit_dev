import * as hmUI from "@zos/ui";
import { log as Logger } from "@zos/utils";
import { BasePage } from "@zeppos/zml/base-page";
import { FETCH_BUTTON, FETCH_RESULT_TEXT } from "zosLoader:./index.[pf].layout.js";

const logger = Logger.getLogger("currency");

let titleWidget;
let textWidget;

function buildText(data) {
  if (!data) {
    return "Нет ответа";
  }
  if (data.error) {
    return "Ошибка:\n" + String(data.error).slice(0, 120);
  }
  const lines = (data.rates || []).map((r) => {
    const value = (r.value / (r.nominal || 1)).toFixed(2);
    return `${r.code} ${value}`;
  });
  if (!lines.length) {
    return "Нет данных";
  }
  const head = data.date ? `${data.date}\n` : "";
  return head + lines.join("\n");
}

Page(
  BasePage({
    state: {},
    build() {
      titleWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        ...FETCH_RESULT_TEXT,
        y: 20,
        h: 40,
        text_size: 32,
        text: "Курс ЦБ РФ",
      });
      textWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        ...FETCH_RESULT_TEXT,
        text: "Загрузка...",
      });
      hmUI.createWidget(hmUI.widget.BUTTON, {
        ...FETCH_BUTTON,
        click_func: () => {
          logger.log("refresh");
          this.loadRates();
        },
      });
      this.loadRates();
    },
    loadRates(attempt) {
      const n = attempt || 0;
      if (textWidget) {
        textWidget.setProperty(hmUI.prop.TEXT, n ? "Ждём сервис…" : "Загрузка...");
      }
      this.request({ method: "GET_RATES" })
        .then((data) => {
          if (textWidget) {
            textWidget.setProperty(hmUI.prop.TEXT, buildText(data));
          }
        })
        .catch((e) => {
          const msg = String((e && e.message) || e);
          if (n < 6 && /shake|timeout|not running|disconnect/i.test(msg)) {
            setTimeout(() => this.loadRates(n + 1), 2000);
            return;
          }
          if (textWidget) {
            textWidget.setProperty(hmUI.prop.TEXT, "C:" + msg.slice(0, 110));
          }
        });
    },
  })
);
