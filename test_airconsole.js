const { io } = require('socket.io-client');

async function runTest() {
  console.log('--- STARTING AIRCONSOLE MULTIPLAYER TEST ---');
  const SERVER_URL = 'http://localhost:3000';

  // 1. Connect Host Socket
  const host = io(SERVER_URL);
  let roomCode = null;

  await new Promise((resolve) => {
    host.on('connect', () => {
      console.log('✓ Host connected to server');
      host.emit('create-room', null, (res) => {
        console.log('✓ Host created room:', res.roomCode);
        console.log('  Controller URL:', res.controllerUrl);
        roomCode = res.roomCode;
        resolve();
      });
    });
  });

  // 2. Connect Mobile Phone 1
  const phone1 = io(SERVER_URL);
  let p1Assigned = null;

  await new Promise((resolve) => {
    phone1.on('connect', () => {
      phone1.emit('join-room', { roomCode, deviceName: 'iPhone 15 Pro' }, (res) => {
        console.log('✓ Phone 1 joined:', res);
        p1Assigned = res.playerNumber;
        resolve();
      });
    });
  });

  if (p1Assigned !== 1) {
    throw new Error(`Expected Player 1, got ${p1Assigned}`);
  }

  // 3. Connect Mobile Phone 2
  const phone2 = io(SERVER_URL);
  let p2Assigned = null;

  await new Promise((resolve) => {
    phone2.on('connect', () => {
      phone2.emit('join-room', { roomCode, deviceName: 'Samsung Galaxy S24' }, (res) => {
        console.log('✓ Phone 2 joined:', res);
        p2Assigned = res.playerNumber;
        resolve();
      });
    });
  });

  if (p2Assigned !== 2) {
    throw new Error(`Expected Player 2, got ${p2Assigned}`);
  }

  // 4. Test High-Frequency Controller Inputs
  console.log('Testing input transmission from Phone 1 and Phone 2...');

  let p1InputReceived = false;
  let p2InputReceived = false;

  host.on('player-input', (data) => {
    if (data.playerNumber === 1 && data.fire === true) {
      p1InputReceived = true;
      console.log('✓ Host received P1 input:', data);
    }
    if (data.playerNumber === 2 && data.boost === true) {
      p2InputReceived = true;
      console.log('✓ Host received P2 input:', data);
    }
  });

  phone1.emit('controller-input', { x: 0.75, y: -0.5, fire: true, boost: false, shield: false });
  phone2.emit('controller-input', { x: -0.8, y: 0.2, fire: false, boost: true, shield: false });

  await new Promise((res) => setTimeout(res, 500));

  if (!p1InputReceived || !p2InputReceived) {
    throw new Error('Input transmission test failed!');
  }

  // 5. Test Haptics / Status Sync from Host to Phones
  console.log('Testing Host -> Phone haptic feedback sync...');
  let p1HapticReceived = false;

  phone1.on('host-sync', ({ type, payload }) => {
    if (type === 'haptic') {
      p1HapticReceived = true;
      console.log('✓ Phone 1 received haptic command:', payload);
    }
  });

  host.emit('sync-to-player', {
    playerNumber: 1,
    type: 'haptic',
    payload: { pattern: [60, 30, 80] }
  });

  await new Promise((res) => setTimeout(res, 500));

  if (!p1HapticReceived) {
    throw new Error('Host to phone sync test failed!');
  }

  console.log('\n🎉 ALL AIRCONSOLE MULTIPLAYER CHECKS PASSED PERFECTLY!\n');
  host.disconnect();
  phone1.disconnect();
  phone2.disconnect();
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

