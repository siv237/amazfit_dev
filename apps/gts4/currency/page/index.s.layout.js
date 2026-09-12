import * as hmUI from "@zos/ui";
import { px } from "@zos/utils";

import {
  DEFAULT_COLOR,
  DEFAULT_COLOR_TRANSPARENT,
} from "../utils/config/constants";
import { DEVICE_WIDTH } from "../utils/config/device";

export const FETCH_BUTTON = {
  x: 75,
  y: 312,
  w: 240,
  h: 60,
  text_size: 22,
  radius: 12,
  normal_color: DEFAULT_COLOR,
  press_color: DEFAULT_COLOR_TRANSPARENT,
  text: "Обновить",
};

export const FETCH_RESULT_TEXT = {
  x: 24,
  y: 92,
  w: 342,
  h: 206,
  color: 0xffffff,
  text_size: 28,
  align_h: hmUI.align.LEFT,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.WRAP,
};
