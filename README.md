# ⚡ AIR-CONSOLE 3D | Mobile-Powered Dual Console Arcade

An AirConsole-inspired multiplayer gaming platform where your **laptop screen acts as the game console / TV display** and **two mobile phones connect as real-time gamepads** to play head-to-head on the same screen over local Wi-Fi.

---

## 🎮 How It Works

```
┌────────────────────────────────────────────────────────┐
│                   LAPTOP DISPLAY SCREEN                │
│     (Hosts 3D Game, Big Screen QR Code & HUD)          │
│               http://localhost:3000                    │
└──────────────────────────┬─────────────────────────────┘
                           │ WebSockets (Ultra-low latency)
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│     PHONE 1 (CYAN)      │ │    PHONE 2 (MAGENTA)    │
│    Mobile Gamepad P1    │ │    Mobile Gamepad P2    │
│  Virtual Stick + Touch  │ │  Virtual Stick + Touch  │
│    Haptic Vibration     │ │    Haptic Vibration     │
└─────────────────────────┘ └─────────────────────────┘
```

1. **Host Screen (Laptop):** Displays a 4-character Room PIN and an auto-generated QR code pointing to your local Wi-Fi IP address.
2. **Controllers (Phones):** Both players open their phone camera, scan the QR code (or visit `http://<laptop-ip>:3000`), and their phones instantly transform into glowing neon tactile gamepads!
3. **No App Store Downloads:** Runs directly in any standard mobile browser (Safari, Chrome, Firefox, Samsung Internet) with zero installation required.

---

## 🕹️ Included 3D Multiplayer Games

### 1. 🚀 Cyber Bumpers: Neon Tank Arena (3D)
- **Gameplay:** 3D hovercraft tank combat arena with bouncing plasma lasers, hover thrusters, and bumper collisions.
- **Abilities:**
  - **FIRE (Laser Cannon):** Dual-modulated plasma bolts that ricochet off arena walls and obstacles.
  - **BOOST (Jet Thruster):** Blazing speed burst with engine fire particles.
  - **SHIELD (Forcefield Bubble):** Translucent hexagonal glowing energy shield that deflects incoming lasers.
  - **Power-Ups:** Speed Overdrive (Yellow), Triple Spread Lasers (Green), Instant Shield Recharge (Blue), and Mega EMP Shockwave (Purple)!
- **Camera:** Cinematic dynamic camera tracking both tanks with smooth distance zoom and screen shake on heavy impacts.

### 2. 🏓 Hyper Pong 3D: Cyber Slam
- **Gameplay:** Futuristic 3D air hockey / curved pong showdown with glowing hover paddles and an electric energy puck.
- **Abilities:**
  - **SMASH:** Hits the puck with ultra-high velocity, dynamic curve trajectories, and sonic shockwaves.
  - **DRIFT & DEFEND:** Precision paddle maneuvering to defend the laser goal gate.
  - **Match:** First to 5 goals wins with celebratory confetti fireworks!

---

## 📱 Mobile Controller Features

- **Dynamic Virtual Thumbstick:** Floating analog joystick appears wherever your thumb touches the left side of the screen.
- **Tactile Haptic Feedback (`navigator.vibrate`):** Real vibration rumbles on laser shots, booster acceleration, taking damage, and victory/defeat.
- **Screen Wake Lock:** Prevents your phone screen from dimming or sleeping while playing.
- **Mirrored HUD:** Real-time health bar, boost meter, and round-trip ping indicator (`ms`) mirrored right onto the phone controller.
- **Optional Gyroscope / Tilt Mode:** Tilt your phone left/right/forward to steer your vehicle physically!
- **Instant Rematch:** Players can trigger a rematch directly from their phone screen after a round ends.

---

## 🚀 Quick Start Guide

### 1. Start the Server
```bash
npm start
```
The console will display:
```
======================================================
  🚀 AIR-CYBER CONSOLE ARCADE SERVER RUNNING!
  💻 Laptop Host Screen : http://localhost:3000
  📱 Mobile Controller  : http://<your-ip>:3000/controller.html
======================================================
```

### 2. Open the Laptop Host Screen
Open your browser on the laptop and navigate to:
```
http://localhost:3000
```

### 3. Connect Two Mobile Phones
1. Connect Phone 1 to the same Wi-Fi / Hotspot as your laptop.
2. Scan the QR code on the laptop screen with Phone 1's camera.
3. Phone 1 connects as **Player 1 (Electric Cyan)**!
4. Repeat with Phone 2 — Phone 2 connects as **Player 2 (Neon Magenta)**!
5. Select a game and click **START BATTLE NOW**!

---

## 🧪 Testing on Laptop (Without Phones)

You can also test dual-player gameplay immediately right on your laptop:
- **Phone Simulator Popups:** Click the **"Open 2 Phone Simulators Side-by-Side"** button on the lobby screen to open two phone-sized gamepad windows.
- **Keyboard Fallback Controls:**
  - **Player 1 (Cyan):**
    - Move: `W`, `A`, `S`, `D`
    - Fire Laser: `Spacebar`
    - Turbo Boost: `Left Shift`
    - Force Shield: `E`
  - **Player 2 (Magenta):**
    - Move: `Arrow Keys`
    - Fire Laser: `Enter` or `Numpad 0`
    - Turbo Boost: `Right Ctrl`
    - Force Shield: `Right Shift`

---

## 🔊 Zero-Asset Web Audio Synthesizer
All sound effects (laser zaps, shield hums, explosions, countdown beeps, engine whooshes, and victory fanfares) are procedurally synthesized in real time using the native browser Web Audio API with zero external audio assets or network lag.

