import * as hmUI from "@zos/ui";
import { px } from "@zos/utils";

import {
  DEFAULT_COLOR,
  DEFAULT_COLOR_TRANSPARENT,
} from "../utils/config/constants";
import { DEVICE_WIDTH } from "../utils/config/device";

const BAND_COLOR = 0x1f6fe0;
const CARD_COLOR = 0x1c1c1e;

export const BAND = {
  x: 0,
  y: 0,
  w: DEVICE_WIDTH,
  h: px(44),
  radius: 0,
  color: BAND_COLOR,
};

export const BUS_IMG = {
  x: px(12),
  y: px(7),
  w: px(30),
  h: px(30),
  src: "bus.png",
};

export const TITLE_TEXT = {
  x: px(50),
  y: px(6),
  w: DEVICE_WIDTH - px(60),
  h: px(32),
  color: 0xffffff,
  text_size: px(22),
  align_h: hmUI.align.LEFT,
  align_v: hmUI.align.CENTER_V,
};

export const STOP_PICKER = {
  x: px(12),
  y: px(0),
  w: DEVICE_WIDTH - 2 * px(12),
  h: px(96),
  nb_of_columns: 1,
  title: "",
  subtitle: "",
  normal_color: 0x7a7a7a,
  select_color: 0xffffff,
};

export const CARD = {
  x: px(10),
  y: px(324),
  w: DEVICE_WIDTH - 2 * px(10),
  h: px(68),
  radius: px(16),
  color: CARD_COLOR,
};

export const RESULT_TEXT = {
  x: px(20),
  y: px(330),
  w: DEVICE_WIDTH - 2 * px(20),
  h: px(56),
  color: 0xffffff,
  text_size: px(22),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.WRAP,
};

export const REFRESH_BUTTON = {
  x: (DEVICE_WIDTH - px(150)) / 2,
  y: px(402),
  w: px(150),
  h: px(42),
  text_size: px(20),
  radius: px(21),
  normal_color: DEFAULT_COLOR,
  press_color: DEFAULT_COLOR_TRANSPARENT,
  text: "Обновить",
};
