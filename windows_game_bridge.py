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
    """Sends keystrokes via both SendInput and direct PostMessage to Hot Wheels."""
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

    # 1. Windows OS SendInput
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

    # 2. Direct Window Message Queue Injection (PostMessage)
    hw = find_hotwheels_window()
    if hw:
        vk = VK_MAP.get(scan_code, 0)
        if vk:
            msg = WM_KEYDOWN if is_pressed else WM_KEYUP
            lparam = (1) | (scan_code << 16)
            if not is_pressed:
                lparam |= (1 << 31) | (1 << 30)
            if is_extended:
                lparam |= (1 << 24)
            user32.PostMessageW(hw, msg, vk, lparam)

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

    # RT -> Accelerator (Gas)
    gas = bool(data.get('btnRT') or data.get('rt') or data.get('gas') or data.get('accelerator'))

    # LT -> Brake / Reverse
    brake = bool(data.get('btnLT') or data.get('lt') or data.get('brake'))

    # A Button -> Boost + Menu Confirm
    boost = bool(data.get('btnA') or data.get('boost'))

    # X Button -> Dash to Left
    dash_left = bool(data.get('btnX') or data.get('dashLeft'))

    # B Button -> Dash to Right + Menu Cancel/Back
    dash_right = bool(data.get('btnB') or data.get('dashRight'))

    # Y Button -> Interact
    interact = bool(data.get('btnY') or data.get('interact'))

    # RB -> Respawn
    respawn = bool(data.get('btnRB') or data.get('rb') or data.get('respawn'))

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

    # Update keystrokes
    update_key(f'{prefix}GAS', gas)
    update_key(f'{prefix}BRAKE', brake)
    update_key(f'{prefix}BOOST', boost)
    if p == 1:
        update_key(f'{prefix}ENTER', boost)  # Also sends Enter for menu select
    update_key(f'{prefix}DASH_LEFT', dash_left)
    update_key(f'{prefix}DASH_RIGHT', dash_right)
    if p == 1 and dash_right:
        update_key(f'{prefix}BACK', dash_right) # Also sends ESC for menu back
    else:
        update_key(f'{prefix}BACK', False)

    update_key(f'{prefix}INTERACT', interact)
    update_key(f'{prefix}RESPAWN', respawn)
    update_key(f'{prefix}LOOKBACK', lookback)
    update_key(f'{prefix}PAUSE', pause)
    update_key(f'{prefix}MAP', island_map)
    update_key(f'{prefix}LEFT', steer_left)
    update_key(f'{prefix}RIGHT', steer_right)

def main():
    hw = find_hotwheels_window()
    print(f"[Windows DirectInput Bridge] Ready! Hot Wheels Window: {hw}", flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            packet = json.loads(line)
            process_controller_packet(packet)
        except Exception:
            pass

if __name__ == '__main__':
    main()
