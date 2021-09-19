import SerialPort from 'serialport';

const START_OF_MESSAGE_DELIMITER = 0x7e;
const SEND_DMX_PACKET_REQUEST_LABEL = 6;
const END_OF_MESSAGE_DELIMITER = 0xe7;

async function findAndConnectEnttecDevice(): Promise<SerialPort> {
    const ports = await SerialPort.list();
    const enttecPorts = ports.filter((p) => p.manufacturer?.toUpperCase() === 'ENTTEC');

    if (enttecPorts.length === 0) {
        throw new Error('There is no serial port with manufacturer ENTTEC. Aborting!');
    }
    if (enttecPorts.length > 1) {
        console.warn('It appears that more than one ENTTEC device is connected. Using the first one...');
    }

    console.log('Using ENTTEC device with serial number ' + enttecPorts[0].serialNumber);
    const path = enttecPorts[0].path;
    return new SerialPort(path);
}

function sendMessage(
    serial: SerialPort,
    label: number,
    data: number[],
    callback?: (error: Error | null | undefined, bytesWritten: number) => void,
): void {
    const lengthLsb = data.length & 0xff;
    const lengthMsb = data.length >> 8;

    serial.write([START_OF_MESSAGE_DELIMITER, label, lengthLsb, lengthMsb, ...data, END_OF_MESSAGE_DELIMITER], callback);
}

let offfset = 0;
function doExample(serial: SerialPort) {
    offfset++;
    offfset = offfset > 255 ? 0 : offfset;

    const dmxValues = Array(513).fill(0);

    // LightmaXX LED Color Bar

    // Setup
    dmxValues[0] = 0;
    dmxValues[1] = 12;
    dmxValues[2] = 255;
    dmxValues[3] = 0;

    // RGB 1
    dmxValues[4] = offfset;
    dmxValues[5] = 255 - offfset;
    dmxValues[6] = 0;

    // RGB 2
    dmxValues[7] = 0;
    dmxValues[8] = offfset;
    dmxValues[9] = 255 - offfset;

    // RGB 3
    dmxValues[10] = 255 - offfset;
    dmxValues[11] = 0;
    dmxValues[12] = offfset;

    sendMessage(serial, SEND_DMX_PACKET_REQUEST_LABEL, dmxValues);
}

findAndConnectEnttecDevice().then((serial) => {
    setInterval(() => doExample(serial), 10);
});
