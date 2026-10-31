"""
=============================================================================
  🏎️ AIR-CONSOLE 3D -> WINDOWS NATIVE DIRECTINPUT & POSTMESSAGE BRIDGE
  HOT WHEELS INFINITE RUSH / UNLEASHED ULTRA-RESPONSIVE ENGINE
=============================================================================
Features:
- Connects directly to Windows interactive desktop (WinSta0\\Default)
- Dual input pipeline: DirectInput SendInput + Win32 PostMessage directly
  to the Hot Wheels game window handle
- Automatic window focus restoration so Hot Wheels never loses input
- Supports both racing controls and in-game menu navigation
=============================================================================
"""

import sys
import json
import time
import ctypes
from ctypes import wintypes
import atexit
import signal

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

# ---------------------------------------------------------------------------
# 1. Attach to Interactive Window Station & Desktop (WinSta0\Default)
# ---------------------------------------------------------------------------
def attach_to_user_desktop():
    try:
        hwinsta = user32.OpenWindowStationW('WinSta0', False, 0x37F)
        if hwinsta:
            user32.SetProcessWindowStation(hwinsta)
        hdesk = user32.OpenDesktopW('Default', 0, False, 0x1FF)
        if hdesk:
            user32.SetThreadDesktop(hdesk)
    except Exception:
        pass

attach_to_user_desktop()

# ---------------------------------------------------------------------------
# 2. Dynamic Hot Wheels Window Detection
# ---------------------------------------------------------------------------
hotwheels_hwnd = None
last_window_check = 0

WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

def find_hotwheels_window():
    global hotwheels_hwnd, last_window_check
    now = time.time()
    if hotwheels_hwnd and (now - last_window_check < 4.0):
        if user32.IsWindow(hotwheels_hwnd):
            return hotwheels_hwnd

    last_window_check = now
    found_hwnd = None

    def enum_cb(hwnd, lparam):
        nonlocal found_hwnd
        length = user32.GetWindowTextLengthW(hwnd)
        if length > 0:
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            t = buff.value.lower()
            if 'hot wheels' in t and 'explorer' not in t and 'cmd' not in t:
                found_hwnd = hwnd
                return False
        return True

    attach_to_user_desktop()
    user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
    hotwheels_hwnd = found_hwnd
    return hotwheels_hwnd

# ---------------------------------------------------------------------------
# 3. DirectInput SendInput Structures
# ---------------------------------------------------------------------------
INPUT_KEYBOARD = 1
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_SCANCODE = 0x0008
KEYEVENTF_EXTENDEDKEY = 0x0001

ULONG_PTR = ctypes.c_ulonglong

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ('wVk', wintypes.WORD),
        ('wScan', wintypes.WORD),
        ('dwFlags', wintypes.DWORD),
        ('time', wintypes.DWORD),
        ('dwExtraInfo', ULONG_PTR)
    ]

class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [
        ('uMsg', wintypes.DWORD),
        ('wParamL', wintypes.WORD),
        ('wParamH', wintypes.WORD)
    ]

class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ('dx', wintypes.LONG),
        ('dy', wintypes.LONG),
        ('mouseData', wintypes.DWORD),
        ('dwFlags', wintypes.DWORD),
        ('time', wintypes.DWORD),
        ('dwExtraInfo', ULONG_PTR)
    ]

class _INPUT_UNION(ctypes.Union):
    _fields_ = [
        ('mi', MOUSEINPUT),
        ('ki', KEYBDINPUT),
        ('hi', HARDWAREINPUT)
    ]

class INPUT(ctypes.Structure):
    _anonymous_ = ('u',)
    _fields_ = [
        ('type', wintypes.DWORD),
        ('u', _INPUT_UNION)
    ]

user32.SendInput.argtypes = (wintypes.UINT, ctypes.POINTER(INPUT), ctypes.c_int)
user32.SendInput.restype = wintypes.UINT

WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101

# Virtual Key Codes for PostMessage
VK_MAP = {
    0x11: 0x57,  # W
    0x1F: 0x53,  # S
    0x1E: 0x41,  # A
    0x20: 0x44,  # D
    0x39: 0x20,  # Space
    0x1C: 0x0D,  # Enter
    0x01: 0x1B,  # Escape
    0x0E: 0x08,  # Backspace
    0x10: 0x51,  # Q
    0x12: 0x45,  # E
    0x21: 0x46,  # F
    0x13: 0x52,  # R
    0x2E: 0x43,  # C
    0x32: 0x4D,  # M
    0x48: 0x26,  # Up Arrow
    0x50: 0x28,  # Down Arrow
    0x4B: 0x25,  # Left Arrow
    0x4D: 0x27,  # Right Arrow
}

def send_hardware_and_message_key(scan_code, is_pressed, is_extended=False):
    """Sends keystrokes via direct PostMessage to Hot Wheels, and SendInput ONLY when Hot Wheels is the foreground window."""
    hw = find_hotwheels_window()
    if not hw:
        # Hot Wheels is not running - never bleed simulated keystrokes into other apps or browser!
        return

    # 1. Direct Window Message Queue Injection (PostMessage)
    vk = VK_MAP.get(scan_code, 0)
    if vk:
        msg = WM_KEYDOWN if is_pressed else WM_KEYUP
        lparam = (1) | (scan_code << 16)
        if not is_pressed:
            lparam |= (1 << 31) | (1 << 30)
        if is_extended:
            lparam |= (1 << 24)
        user32.PostMessageW(hw, msg, vk, lparam)

    # 2. Windows OS SendInput - ONLY when Hot Wheels is the active foreground window!
    fg = user32.GetForegroundWindow()
    if fg == hw:
        flags = KEYEVENTF_SCANCODE
        if not is_pressed:
            flags |= KEYEVENTF_KEYUP
        if is_extended:
            flags |= KEYEVENTF_EXTENDEDKEY

        inp = INPUT()
        inp.type = INPUT_KEYBOARD
        inp.ki.wVk = 0
        inp.ki.wScan = scan_code
        inp.ki.dwFlags = flags
        inp.ki.time = 0
        inp.ki.dwExtraInfo = 0
        user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

# Scan code mappings
SCANCODES = {
    # Player 1
    'P1_GAS': (0x11, False),          # RT -> W
    'P1_BRAKE': (0x1F, False),        # LT -> S
    'P1_LEFT': (0x1E, False),         # LS Left -> A
    'P1_RIGHT': (0x20, False),        # LS Right -> D
    'P1_BOOST': (0x39, False),        # A Button -> Space (Boost)
    'P1_ENTER': (0x1C, False),        # A Button (Menu Confirm) -> Enter
    'P1_DASH_LEFT': (0x10, False),    # X Button -> Q
    'P1_DASH_RIGHT': (0x12, False),   # B Button -> E
    'P1_BACK': (0x1B, False),         # B Button (Menu Cancel) -> ESC
    'P1_INTERACT': (0x21, False),     # Y Button -> F
    'P1_RESPAWN': (0x13, False),      # RB -> R
    'P1_LOOKBACK': (0x2E, False),     # LB -> C
    'P1_PAUSE': (0x01, False),        # Menu -> ESC
    'P1_MAP': (0x32, False),          # View -> M

    # Player 2
    'P2_GAS': (0x48, True),           # RT -> Up Arrow
    'P2_BRAKE': (0x50, True),         # LT -> Down Arrow
    'P2_LEFT': (0x4B, True),          # LS Left -> Left Arrow
    'P2_RIGHT': (0x4D, True),         # LS Right -> Right Arrow
    'P2_BOOST': (0x1C, True),         # A Button -> Enter
    'P2_DASH_LEFT': (0x10, False),    # X Button -> Q / [
    'P2_DASH_RIGHT': (0x12, False),   # B Button -> E / ]
    'P2_RESPAWN': (0x52, False),      # RB -> Numpad 0
    'P2_LOOKBACK': (0x2E, False),     # LB -> C
    'P2_PAUSE': (0x01, False),        # Menu -> ESC
    'P2_MAP': (0x32, False),          # View -> M
}

CURRENT_HELD_KEYS = set()

def update_key(key_name, is_down):
    sc, ext = SCANCODES.get(key_name, (0, False))
    if not sc:
        return

    if is_down and key_name not in CURRENT_HELD_KEYS:
        CURRENT_HELD_KEYS.add(key_name)
        send_hardware_and_message_key(sc, True, ext)
    elif not is_down and key_name in CURRENT_HELD_KEYS:
        CURRENT_HELD_KEYS.discard(key_name)
        send_hardware_and_message_key(sc, False, ext)

def release_all():
    for key_name in list(CURRENT_HELD_KEYS):
        sc, ext = SCANCODES.get(key_name, (0, False))
        if sc:
            send_hardware_and_message_key(sc, False, ext)
    CURRENT_HELD_KEYS.clear()

atexit.register(release_all)
signal.signal(signal.SIGINT, lambda s, f: (release_all(), sys.exit(0)))
signal.signal(signal.SIGTERM, lambda s, f: (release_all(), sys.exit(0)))

# ---------------------------------------------------------------------------
# Virtual Xbox 360 Gamepad Engine (ViGEmBus)
# Enables native 2-Player Split-Screen in Hot Wheels without keyboard conflicts
# ---------------------------------------------------------------------------
virtual_gamepads = {}
vigem_available = False

try:
    import vgamepad as vg
    virtual_gamepads[1] = vg.VX360Gamepad()
    virtual_gamepads[2] = vg.VX360Gamepad()
    vigem_available = True
    print("[Windows Game Bridge] 🎮 2 Virtual Xbox 360 Controllers active (P1 & P2)!", flush=True)
except Exception as e:
    vigem_available = False
    print(f"[Windows Game Bridge] ⚠️ Virtual Xbox Controller bus not connected: {e}", flush=True)
    print("[Windows Game Bridge] 💡 Run 'INSTALL_VIRTUAL_CONTROLLERS.bat' to enable 2-Player Split Screen in Hot Wheels!", flush=True)

def ensure_game_focus():
    hw = find_hotwheels_window()
    if hw:
        fg = user32.GetForegroundWindow()
        if fg != hw:
            user32.ShowWindow(hw, 9) # SW_RESTORE
            user32.SetForegroundWindow(hw)

def process_controller_packet(data):
    p = data.get('playerNumber') or data.get('player') or 1
    prefix = f'P{p}_'

    # Any button activity ensures game window is active
    ensure_game_focus()

    # RT / A Button / Joystick Up -> Accelerator (Gas)
    gas = bool(
        data.get('gas') or
        data.get('btnRT') or
        data.get('btnA') or
        data.get('rt') or
        data.get('accel') or
        data.get('fire') or
        (float(data.get('y', 0)) < -0.3)
    )

    # LT / B Button / Joystick Down -> Brake / Reverse
    brake = bool(
        data.get('brake') or
        data.get('btnLT') or
        data.get('btnB') or
        data.get('lt') or
        (float(data.get('y', 0)) > 0.3)
    )

    # Y / X / RB Button -> Nitro Boost
    boost = bool(
        data.get('boost') or
        data.get('btnY') or
        data.get('btnX') or
        data.get('btnRB') or
        data.get('rb')
    )

    # X Button -> Dash to Left
    dash_left = bool(data.get('btnX') or data.get('dashLeft'))

    # B Button -> Dash to Right + Menu Cancel/Back
    dash_right = bool(data.get('btnB') or data.get('dashRight'))

    # Y Button -> Interact
    interact = bool(data.get('btnY') or data.get('interact'))

    # RB -> Respawn
    respawn = bool(data.get('respawn') or data.get('btnLB') or data.get('lb') or data.get('btnRB') or data.get('select'))

    # LB -> Look Back
    lookback = bool(data.get('btnLB') or data.get('lb') or data.get('lookback'))

    # Menu -> Pause
    pause = bool(data.get('start') or data.get('pause'))

    # View -> Island Map
    island_map = bool(data.get('select') or data.get('map'))

    # Steering: Combines thumbstick X and tiltX
    steer = 0.0
    if 'x' in data and abs(float(data['x'])) > 0.08:
        steer = float(data['x'])
    elif 'tiltX' in data and abs(float(data['tiltX'])) > 2.0:
        steer = max(-1.0, min(1.0, float(data['tiltX']) / 45.0))

    steer_left = steer < -0.18
    steer_right = steer > 0.18

    # 1. Native Virtual Xbox Controller update (Solves Split Screen & Camera Conflict!)
    if vigem_available and p in virtual_gamepads:
        gp = virtual_gamepads[p]
        gp.reset()

        # Left Thumbstick (Steer)
        gp.left_joystick_float(x_value_float=float(steer), y_value_float=0.0)

        # Triggers (Right Trigger = Gas, Left Trigger = Brake)
        gp.right_trigger_float(value_float=1.0 if gas else 0.0)
        gp.left_trigger_float(value_float=1.0 if brake else 0.0)

        # Face & Shoulder Buttons
        # In Hot Wheels Split Screen, pressing (A) joins Player 2!
        if bool(data.get('btnA') or data.get('gas') or data.get('fire')):
            gp.press_button(button=vg.XUSB_BUTTON.XUSB_GAMEPAD_A)

        if bool(data.get('btnB') or data.get('brake')):
            gp.press_button(button=vg.XUSB_BUTTON.XUSB_GAMEPAD_B)

        if bool(data.get('btnX') or data.get('dashLeft') or data.get('drift')):
            gp.press_button(button=vg.XUSB_BUTTON.XUSB_GAMEPAD_X)

        if bool(data.get('btnY') or data.get('boost') or data.get('interact')):
            gp.press_button(button=vg.XUSB_BUTTON.XUSB_GAMEPAD_Y)

        if bool(data.get('btnRB')):
            gp.press_button(button=vg.XUSB_BUTTON.XUSB_GAMEPAD_RIGHT_SHOULDER)

        if bool(data.get('btnLB') or data.get('respawn')):
            gp.press_button(button=vg.XUSB_BUTTON.XUSB_GAMEPAD_LEFT_SHOULDER)

        if bool(data.get('start') or data.get('pause')):
            gp.press_button(button=vg.XUSB_BUTTON.XUSB_GAMEPAD_START)

        if bool(data.get('select') or data.get('map')):
            gp.press_button(button=vg.XUSB_BUTTON.XUSB_GAMEPAD_BACK)

        gp.update()
        # When virtual gamepads are active, skip keyboard injection so camera NEVER moves!
        return

    # Update fallback keystrokes (if virtual gamepad driver is not installed)
    update_key(f'{prefix}GAS', gas)
    update_key(f'{prefix}BRAKE', brake)
    update_key(f'{prefix}BOOST', boost)
    update_key(f'{prefix}DASH_LEFT', dash_left)
    update_key(f'{prefix}DASH_RIGHT', dash_right)

    update_key(f'{prefix}INTERACT', interact)
    update_key(f'{prefix}RESPAWN', respawn)
    update_key(f'{prefix}LOOKBACK', lookback)
    update_key(f'{prefix}PAUSE', pause)
    update_key(f'{prefix}MAP', island_map)
    update_key(f'{prefix}LEFT', steer_left)
    update_key(f'{prefix}RIGHT', steer_right)

MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x000A
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800

def process_mouse_packet(data):
    attach_to_user_desktop()
    action = data.get('action')
    screen_w = user32.GetSystemMetrics(0)
    screen_h = user32.GetSystemMetrics(1)

    if action == 'move':
        x = int(float(data.get('x', 0)) * screen_w)
        y = int(float(data.get('y', 0)) * screen_h)
        user32.SetCursorPos(x, y)
    elif action == 'click':
        btn = data.get('button', 'left')
        if btn == 'left':
            user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        elif btn == 'right':
            user32.mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
            user32.mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
    elif action == 'down':
        btn = data.get('button', 'left')
        flag = MOUSEEVENTF_LEFTDOWN if btn == 'left' else MOUSEEVENTF_RIGHTDOWN
        user32.mouse_event(flag, 0, 0, 0, 0)
    elif action == 'up':
        btn = data.get('button', 'left')
        flag = MOUSEEVENTF_LEFTUP if btn == 'left' else MOUSEEVENTF_RIGHTUP
        user32.mouse_event(flag, 0, 0, 0, 0)
    elif action == 'scroll':
        dy = int(float(data.get('deltaY', 0)) * -120)
        user32.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, dy, 0)

def process_key_packet(data):
    attach_to_user_desktop()
    char = data.get('char', '')
    if char:
        vk = user32.VkKeyScanW(ord(char)) & 0xFF
        if vk:
            user32.keybd_event(vk, 0, 0, 0)
            user32.keybd_event(vk, 0, 2, 0)

import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

class BridgeHTTPHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        hw = find_hotwheels_window()
        self.wfile.write(json.dumps({'status': 'ok', 'bridge': 'active', 'hotwheels_hwnd': hw}).encode('utf-8'))

    def do_POST(self):
        content_len = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_len)
        try:
            data = json.loads(post_body.decode('utf-8'))
            if data.get('type') == 'mouse':
                process_mouse_packet(data)
            elif data.get('type') == 'key':
                process_key_packet(data)
            else:
                process_controller_packet(data)
        except Exception:
            pass

        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"success":true}')

    def log_message(self, format, *args):
        return

def start_http_server(port=8088):
    try:
        server = HTTPServer(('127.0.0.1', port), BridgeHTTPHandler)
        print(f"[Windows DirectInput Bridge] HTTP Receiver listening on http://127.0.0.1:{port}", flush=True)
        server.serve_forever()
    except Exception as e:
        print(f"[Windows DirectInput Bridge] HTTP Receiver notice: {e}", flush=True)

def main():
    hw = find_hotwheels_window()
    print(f"[Windows DirectInput Bridge] Ready! Hot Wheels Window: {hw}", flush=True)
    t = threading.Thread(target=start_http_server, daemon=True)
    t.start()

    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                packet = json.loads(line)
                ptype = packet.get('type')
                if ptype == 'mouse':
                    process_mouse_packet(packet)
                elif ptype == 'key':
                    process_key_packet(packet)
                else:
                    process_controller_packet(packet)
            except Exception:
                pass
    except (KeyboardInterrupt, SystemExit):
        release_all()
    except Exception:
        while True:
            time.sleep(1)

if __name__ == '__main__':
    main()
