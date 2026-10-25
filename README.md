# Hybrid Heating for Home Assistant

Heating control for a flat with an electric boiler and radiators, plus heat-pump air conditioners in some rooms.

**Status:** early development. The control logic is done and tested; the Home Assistant integration and the dashboard card are in progress.

## What it does

- **Heat pumps first.** Each AC holds its own room using that room's temperature sensor, not the unit's built-in one. The boiler covers the rooms without an AC and steps in when an AC can't keep up.
- **Radiators that never go cold.** The boiler runs a weather-compensated flow curve, corrected by the room temperatures, instead of switching on and off. You set the curve with 9 points, one every 5 °C.
- **Weather zones.** Outdoor temperature bands decide which ACs run, how the boiler works (off, backup or main), and how many heating rods it may use.
- **Per-room targets.** Each room gets an offset from the preset target, for example a cooler child's room.
- **Load shedding.** When the whole flat stays over the power limit (8 kW, held 5 s by default), the module pauses the boiler, switches off the water heater and lowers the boiler's rods. It never touches the ACs.
- **Safe roll-out.** Each layer (boiler, ACs, load) can be off, observe-only or active. In observe mode the module logs what it would do and changes nothing.
- **Explains itself.** Every decision comes with a reason.

## Development

Requires [uv](https://docs.astral.sh/uv/) and Python 3.14.

```bash
uv sync
uv run pytest -m "not replay"   # fast tests
uv run pytest -m replay         # season replay on a thermal model of a flat
```

The season replay runs on `local/data/season.csv` when you provide one (hourly `ts,t_out,boiler_kw,total_kw`; see `tools/export_history.py`). Without it, it uses a deterministic synthetic season. The `local/` folder is git-ignored and meant for private data.

## License

MIT
