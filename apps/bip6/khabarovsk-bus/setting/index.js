import { gettext } from "i18n";

AppSettingsPage({
  state: {
    places: [],
    form: { name: "", lat: "", lng: "" },
    status: "",
  },

  load(props) {
    this.props = props;
    const raw = props.settingsStorage.getItem("places");
    this.state.places = raw ? JSON.parse(raw) : [];
  },

  persist() {
    this.props.settingsStorage.setItem("places", JSON.stringify(this.state.places));
  },

  add() {
    const f = this.state.form;
    const lat = parseFloat(String(f.lat).replace(",", "."));
    const lng = parseFloat(String(f.lng).replace(",", "."));
    if (!f.name || !f.name.trim() || isNaN(lat) || isNaN(lng)) {
      this.state.status = "Ошибка: заполните Название, Широту и Долготу";
      return;
    }
    this.state.places = this.state.places.concat([
      { id: Date.now(), name: f.name.trim(), lat, lng },
    ]);
    this.state.form = { name: "", lat: "", lng: "" };
    this.state.status = "Сохранено: " + f.name.trim();
    this.persist();
  },

  del(index) {
    this.state.places = this.state.places.filter((_, i) => i !== index);
    this.state.status = "Удалено";
    this.persist();
  },

  field(label, key, placeholder, width) {
    const self = this;
    return TextInput({
      label,
      placeholder,
      value: self.state.form[key],
      labelStyle: { fontSize: "12px", color: "#666" },
      style: { width, marginRight: "8px" },
      onChange: (val) => {
        self.state.form[key] = val;
      },
    });
  },

  build(props) {
    this.load(props);
    const self = this;

    const rows = self.state.places.map((p, i) =>
      View(
        {
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            padding: "8px 0",
            borderBottom: "1px solid #eee",
          },
        },
        [
          Text(
            { style: { flex: "1", fontSize: "14px", color: "#222" } },
            [p.name + "  —  " + p.lat + ", " + p.lng],
          ),
          Button({
            label: "Удалить",
            style: {
              fontSize: "12px",
              borderRadius: "16px",
              background: "#D85E33",
              color: "white",
              padding: "4px 12px",
            },
            onClick: () => self.del(i),
          }),
        ],
      ),
    );

    return View({ style: { padding: "16px" } }, [
      Text(
        { paragraph: true, style: { fontSize: "13px", color: "#888", marginBottom: "12px" } },
        [
          "Формат: Название + Широта + Долгота. " +
            "Пример: Дом, 48.4827, 135.0838 (дробная часть — точка или запятая).",
        ],
      ),
      View(
        {
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-end",
            marginBottom: "10px",
          },
        },
        [
          self.field("Название", "name", "Дом", "34%"),
          self.field("Широта", "lat", "48.4827", "28%"),
          self.field("Долгота", "lng", "135.0838", "28%"),
        ],
      ),
      View(
        { style: { display: "flex", flexDirection: "row", alignItems: "center" } },
        [
          Button({
            label: "Добавить",
            style: {
              fontSize: "13px",
              borderRadius: "16px",
              background: "#409EFF",
              color: "white",
              padding: "6px 16px",
            },
            onClick: () => self.add(),
          }),
          self.state.status
            ? Text(
                { style: { fontSize: "12px", color: "#409EFF", marginLeft: "12px" } },
                [self.state.status],
              )
            : null,
        ],
      ),
      View({ style: { marginTop: "16px" } }, rows),
    ]);
  },
});
