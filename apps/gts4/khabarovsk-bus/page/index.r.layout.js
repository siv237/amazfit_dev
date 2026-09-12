import * as hmUI from "@zos/ui";
import { px } from "@zos/utils";

import {
  DEFAULT_COLOR,
  DEFAULT_COLOR_TRANSPARENT,
} from "../utils/config/constants";
import { DEVICE_WIDTH } from "../utils/config/device";

export const STOP_PICKER = {
  x: px(56),
  y: px(48),
  w: DEVICE_WIDTH - 2 * px(56),
  h: px(140),
  nb_of_columns: 1,
  title: "",
  subtitle: "",
  normal_color: 0xaaaaaa,
  select_color: 0xffffff,
};

export const RESULT_TEXT = {
  x: px(40),
  y: px(210),
  w: DEVICE_WIDTH - 2 * px(40),
  h: px(150),
  color: 0xffffff,
  text_size: px(28),
  align_h: hmUI.align.LEFT,
  align_v: hmUI.align.TOP,
  text_style: hmUI.text_style.WRAP,
};

export const REFRESH_BUTTON = {
  x: (DEVICE_WIDTH - px(220)) / 2,
  y: px(380),
  w: px(220),
  h: px(60),
  text_size: px(26),
  radius: px(10),
  normal_color: DEFAULT_COLOR,
  press_color: DEFAULT_COLOR_TRANSPARENT,
  text: "Обновить",
};
