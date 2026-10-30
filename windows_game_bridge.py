"""
=============================================================================
  🎮 AIR-CONSOLE 3D -> WINDOWS NATIVE DIRECTINPUT HARDWARE BRIDGE
=============================================================================
This script receives mobile controller inputs from Air-Console and injects
real hardware DirectInput scan codes directly into the Windows OS kernel
so that Unreal Engine, DirectX, and Hot Wheels Unleashed react with zero lag!
=============================================================================
"""

import sys
import json
import ctypes
from ctypes import wintypes
import atexit
import signal

# ---------------------------------------------------------------------------
# Windows DirectInput Scan Codes & Win32 API Definitions
# ---------------------------------------------------------------------------
user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

# Attach to the active user desktop (bypasses service / background isolation)
try:
    hDesk = user32.OpenInputDesktop(0, False, 0x01FF)
    if hDesk:
        user32.SetThreadDesktop(hDesk)
except Exception as e:
    pass

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

def send_hardware_key(scan_code, is_pressed, is_extended=False):
    """Sends a real DirectInput hardware scan code to Windows OS."""
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

    return user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

# DirectInput Hardware Scan Codes (Set 1)
SCANCODES = {
    # Player 1
    'P1_GAS': (0x11, False),        # W
    'P1_BRAKE': (0x1F, False),      # S
    'P1_LEFT': (0x1E, False),       # A
    'P1_RIGHT': (0x20, False),      # D
    'P1_BOOST': (0x39, False),      # Space
    'P1_DRIFT': (0x2A, False),      # Left Shift
    'P1_RESPAWN': (0x13, False),    # R

    # Player 2
    'P2_GAS': (0x48, True),         # Up Arrow (Extended)
    'P2_BRAKE': (0x50, True),       # Down Arrow (Extended)
    'P2_LEFT': (0x4B, True),        # Left Arrow (Extended)
    'P2_RIGHT': (0x4D, True),       # Right Arrow (Extended)
    'P2_BOOST': (0x1C, True),       # Enter / Numpad Enter (Extended)
    'P2_DRIFT': (0x36, False),      # Right Shift
    'P2_RESPAWN': (0x52, False),    # Numpad 0
}

# Track which keys are currently held down
CURRENT_HELD_KEYS = set()

def update_key(key_name, is_down):
    sc, ext = SCANCODES.get(key_name, (0, False))
    if not sc:
        return

    if is_down and key_name not in CURRENT_HELD_KEYS:
        CURRENT_HELD_KEYS.add(key_name)
        send_hardware_key(sc, True, ext)
    elif not is_down and key_name in CURRENT_HELD_KEYS:
        CURRENT_HELD_KEYS.discard(key_name)
        send_hardware_key(sc, False, ext)

def release_all():
    """Safety cleanup: release all pressed keys on exit so nothing sticks."""
    for key_name in list(CURRENT_HELD_KEYS):
        sc, ext = SCANCODES.get(key_name, (0, False))
        if sc:
            send_hardware_key(sc, False, ext)
    CURRENT_HELD_KEYS.clear()

atexit.register(release_all)
signal.signal(signal.SIGINT, lambda s, f: (release_all(), sys.exit(0)))
signal.signal(signal.SIGTERM, lambda s, f: (release_all(), sys.exit(0)))

def process_controller_packet(data):
    """Processes normalized input from Player 1 or Player 2."""
    p = data.get('playerNumber') or data.get('player') or 1
    prefix = f'P{p}_'

    # Gas / Accelerate
    gas = bool(data.get('gas') or data.get('btnA') or data.get('fire'))
    # Brake / Reverse
    brake = bool(data.get('brake') or data.get('btnB'))
    # Boost / Nitro
    boost = bool(data.get('boost') or data.get('btnY') or data.get('btnR'))
    # Drift / Handbrake
    drift = bool(data.get('drift') or data.get('btnL'))
    # Respawn
    respawn = bool(data.get('respawn') or data.get('btnX'))

    # Steering: Combines thumbstick X (-1 to +1) and Gyro TiltX (-30 to +30 deg)
    steer = 0.0
    if 'x' in data and abs(float(data['x'])) > 0.15:
        steer = float(data['x'])
    elif 'tiltX' in data and abs(float(data['tiltX'])) > 3.0:
        steer = max(-1.0, min(1.0, float(data['tiltX']) / 25.0))

    steer_left = steer < -0.22
    steer_right = steer > 0.22

    # Update Windows hardware keystrokes
    update_key(f'{prefix}GAS', gas)
    update_key(f'{prefix}BRAKE', brake)
    update_key(f'{prefix}BOOST', boost)
    update_key(f'{prefix}DRIFT', drift)
    update_key(f'{prefix}RESPAWN', respawn)
    update_key(f'{prefix}LEFT', steer_left)
    update_key(f'{prefix}RIGHT', steer_right)

def main():
    print("[Windows DirectInput Bridge] Started successfully! Ready for Hot Wheels input.", flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            packet = json.loads(line)
            process_controller_packet(packet)
        except Exception as e:
            pass

if __name__ == '__main__':
    main()

