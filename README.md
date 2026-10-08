# 🚁 BetaFPV Web Sim

**Browser-based FPV drone simulator** controlled with a physical **BetaFPV LiteRadio 2 SE** radio via the **WebHID API**.

Written entirely in JavaScript (ES Modules) using **Three.js** for 3D rendering. No installation required — just a Chromium-based browser.

🇬🇧 **English** · [🇵🇱 Polski](README.pl.md)

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Three.js](https://img.shields.io/badge/Three.js-0.160-blue)
![WebHID](https://img.shields.io/badge/WebHID-Chrome%2FEdge%2FOpera%2FBrave-green)

![Flight simulation](./img/sym1.jpg)

🔗 **Live demo:** https://betafpv.vercel.app

---

## ✨ Features

- 🎮 **Direct BetaFPV LiteRadio 2 SE support** via WebHID — no drivers needed.
- 🗺️ **Axis mapping wizard** — move the sticks, see which byte pairs move, and assign them to drone functions.
- 🎯 **Automatic range calibration** — measures min/max/center for each axis.
- 🌍 **Four difficulty levels** — Easy / Medium / Expert / Race, with different physics and scenery.
- 👻 **Ghost Replay** — your previous best lap is saved locally and races against you. Beat it, lose to it, or **ram it out of the sky**.
- 🎨 **3D scene in Three.js** — gradient shader sky, fog, PCFSoft shadows, trees, hills, water, gates and obstacles.
- 📊 **Real-time HUD** — throttle, yaw, roll, pitch, altitude, speed, gate counter, timer and delta vs. ghost.
- 🧭 **FPV camera angle switch** — 0° / 20° / 35° using a 3-position radio switch.
- 🌐 **Bilingual UI** — English / Polish with automatic language detection.
- 🔄 **Auto-connect** — reconnects to the radio on startup if it was previously authorized.
- 🛠️ **Diagnostic tool** — `detector.html` for analyzing raw HID reports.

---

## ⚙️ Requirements

### Browser

- **Chrome / Edge / Opera / Brave** version **89+** with WebHID support.
- ❌ Firefox and Safari **do not support WebHID**.
- The page must be served over **HTTPS** or from `localhost`.
- WebHID does not work with `file://`.

### Hardware

- **BetaFPV LiteRadio 2 SE** radio (VID `0x0483`, PID `0x5750`).
- USB cable.
- The radio must be in **Joystick** mode, not charging mode.

### Local server

Any local HTTP server will work:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

Then open:

```text
http://localhost:8000
```

---

## 🎮 How to use

### Step 1/4 — Connect the radio

Click **Connect radio** and select **BETAFPV Joystick** from the device list.

### Step 2/4 — Axis mapping

Move each stick in every direction and observe which bars move. Then assign the byte pairs (`P0–P7`) to the drone functions:

| Function | Stick | Direction |
|---|---|---|
| THROTTLE | Left | Up / Down |
| YAW | Left | Left / Right |
| PITCH | Right | Up / Down |
| ROLL | Right | Left / Right |
| CAMERA | Switch SA/SB/SC | 3-position |

Unassigned pairs (`---`) are ignored by the simulator.

> ⚠️ **Important:** Mapping must be repeated after refreshing the page. The radio generates signals on different byte pairs each time it connects, so the mapping cannot be saved permanently. Calibration is remembered in the browser as long as the radio remains connected.

### Step 3/4 — Range calibration

The app will ask you to move each function in turn.

Move the stick to the limit in both directions. Calibration takes approximately **4 seconds per function**, around **16 seconds total**.

### Step 4/4 — Choose a world

Pick a difficulty level and take off.

During flight, you can return to the menu using the **⬅ Menu** button in the top-right corner.

---

## 🕹️ Controls

### Radio sticks — Mode 2

| Function | Stick | Effect |
|---|---|---|
| Throttle | Left ↑↓ | Motor thrust |
| Yaw | Left ←→ | Rotation around vertical axis |
| Pitch | Right ↑↓ | Forward/backward tilt |
| Roll | Right ←→ | Left/right tilt |

### Keyboard

| Key | Action |
|---|---|
| `P` | Pause / resume |
| `Space` | Toggle OSD crosshair |
| `K` | Cycle camera angle |
| `R` | Emergency full restart — no record saved |
| `M` | Master mute — engine + music |
| `N` | Mute engine only |
| `B` | Mute background music only |

---

## 👻 Ghost Replay

The simulator saves your best lap time for each world in `localStorage`.

Storage key:

```text
betafpv_ghost_<worldId>
```

On the next run, a semi-transparent ghost drone races against you along your previous trajectory.

### Race flow

The ghost starts only after you pass **gate #1**. The timer also starts at that moment.

A 6-second intro appears:

> 👻 Your previous best is chasing you! Record: XX.XXXs

### Three possible outcomes

- 🏆 **You win** — you reach the last gate first. The result overlay shows your time versus the ghost's.
- 🍌 **You lose** — the ghost reaches the finish first. You can still finish your lap.
- 💥 **You destroy the ghost** — ram it from behind while you're ahead. The overlay shows **GHOST DESTROYED!**, with flames and screen shake.

The simulator automatically resets **3 seconds** after the result.

Press `R` for an emergency restart. No record is saved.

---

## 🛠️ Adding obstacles to tracks

Track files are located in `worlds/`, with one module per world.

Full guides:

- 🇵🇱 Polish: `worlds/info_pl.txt`
- 🇬🇧 English: `worlds/info_en.txt`

---

## ❌ Not supported out of the box

### XInput gamepads

Xbox, DualShock and DualSense controllers are not accessible through WebHID for security reasons.

Support would require migration to the **Gamepad API**.

### DJI RC-N1

DJI RC-N1 controllers used with Mini 2 / Air 2 / Mini 3 are not recognized as HID devices after USB connection.

They require an external converter, for example `DJI_RC-N1_SIMULATOR_FLY_DCL`, together with the Gamepad API.

### Radiomaster / TBS

Radiomaster Zorro / Pocket and TBS Tango 2 are theoretically compatible in USB Joystick mode, but require changing the VID/PID in the code.

---

## 🚧 Known issues / TODO

| # | Issue | Priority |
|---:|---|---|
| 1 | Autoplay policy on localhost — Vercel works, localhost requires a click | Low |
| 2 | Axis mapping is not persisted — WebHID limitation | Medium |
| 3 | XInput gamepads do not work — requires Gamepad API | Medium |
| 4 | DJI RC-N1 does not work — requires a converter | Low |
| 5 | Maximum audible gates verification (raycast) | Low |
| 6 | `img/poster.jpg` unused — removed from `<video>` | Cosmetic |

---

## 🤝 Contributing

Pull requests and bug reports are welcome!

If you want to add support for a new radio, open an Issue and include:

- Model name
- VID / PID

---

## 📜 License

Released under the **MIT License**.

---

## 🙏 Credits

- **Three.js** — 3D engine
- **WebHID API** — radio support
- **The FPV community** — feedback and testing

---

🇵🇱 **[Read the Polish version →](README.pl.md)**

🔗 **[Launch the simulator →](https://betafpv.vercel.app)**

**Happy flying! 🚁💨**
