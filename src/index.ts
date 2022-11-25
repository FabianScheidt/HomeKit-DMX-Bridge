import { SerialPort } from 'serialport';
import { Accessory, Categories, uuid } from 'hap-nodejs';
import { LightmaxxLedBar } from './fixtures/lightmaxx-led-bar';
import { Fixture } from './fixture';
import { EuroliteTmh14 } from './fixtures/eurolite-tmh-14';

const START_OF_MESSAGE_DELIMITER = 0x7e;
const GET_WIDGET_PARAMETER_REQUEST_LABEL = 3;
const SEND_DMX_PACKET_REQUEST_LABEL = 6;
const END_OF_MESSAGE_DELIMITER = 0xe7;

class HapToDmxMapper {
    protected accessory?: Accessory;
    protected serial?: SerialPort;

    constructor(protected readonly fixtures: Fixture[]) {}

    public async initialize() {
        await this.initializeSerial();
        this.initializeAccessory();
    }

    protected async initializeSerial() {
        const ports = await SerialPort.list();
        let enttecPorts = ports.filter((p) => p.manufacturer?.toUpperCase() === 'ENTTEC');

        if (enttecPorts.length === 0) {
            console.warn('There is no serial port with manufacturer ENTTEC. Attempting to guess the correct port...');
            enttecPorts = ports.filter((p) => p.path?.toUpperCase().indexOf('USB') > -1);
            if (enttecPorts.length === 0) {
                throw new Error('There is no matching serial port. Aborting!');
            }
        }
        if (enttecPorts.length > 1) {
            console.warn('It appears that more than one device is connected. Using the first one...');
        }

        console.log('Using device with serial number ' + enttecPorts[0].serialNumber);
        const path = enttecPorts[0].path;

        await new Promise((resolve, reject) => {
            this.serial = new SerialPort({ path, baudRate: 115200 }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Connected.');
                    resolve(void 0);
                }
            });
        });

        console.log('Requesting Parameters...');
        const parameters = await this.getWidgetParameters();
        console.log(parameters);

        console.log('Now sending DMX data...');
        const outputRate = Math.min(parameters.dmxOutputRate, 25);
        setInterval(() => this.sendDmx(), 1000 / outputRate);
    }

    protected initializeAccessory() {
        const accessoryUuid = uuid.generate('com.fabian-scheidt.hap-dmx');
        this.accessory = new Accessory('HAP-DMX LED-Bar', accessoryUuid);
        for (const fixture of this.fixtures) {
            this.accessory.addService(fixture.getHapService());
        }

        this.accessory.publish({
            username: '46:f8:33:74:ff:30',
            pincode: '211-51-758',
            category: Categories.LIGHTBULB,
        });
    }

    protected async sendSerialMessage(label: number, data: number[]): Promise<void> {
        const lengthLsb = data.length & 0xff;
        const lengthMsb = data.length >> 8;
        const buffer = Buffer.from([START_OF_MESSAGE_DELIMITER, label, lengthLsb, lengthMsb, ...data, END_OF_MESSAGE_DELIMITER]);

        await this.serial?.port?.write(buffer);
    }

    protected async readSerialMessage(): Promise<[number, number[]]> {
        let startByteReceived = false;
        const message = [];
        while (true) {
            if (!this.serial?.port) {
                throw new Error('Serial Port not set');
            }

            const readBuffer = Buffer.from([0]);
            await this.serial.port.read(readBuffer, 0, 1);
            const readByte = readBuffer[0];
            if (readByte == START_OF_MESSAGE_DELIMITER) {
                startByteReceived = true;
                continue;
            }
            if (!startByteReceived) {
                continue;
            }
            if (readByte === END_OF_MESSAGE_DELIMITER) {
                break;
            }
            message.push(readByte);
        }

        const label = message[0];
        const length = message[1] + (message[2] << 8);
        const dataBytes = message.slice(3);

        if (dataBytes.length !== length) {
            throw new Error('Expected data length to be ' + length + ' but received ' + dataBytes.length);
        }

        return [label, dataBytes];
    }

    protected async getWidgetParameters() {
        await this.serial?.port?.flush();
        await this.sendSerialMessage(GET_WIDGET_PARAMETER_REQUEST_LABEL, [0, 0]);
        const [label, dataBytes] = await this.readSerialMessage();

        if (label !== GET_WIDGET_PARAMETER_REQUEST_LABEL) {
            throw new Error('Expected label to be ' + GET_WIDGET_PARAMETER_REQUEST_LABEL + ' but received' + label);
        }

        return {
            firmwareVersion: dataBytes[0] + (dataBytes[1] << 8),
            dmxOutputBreakTime: dataBytes[2] * 10.67,
            dmxOutputMarkAfterBreakTime: dataBytes[3] * 10.67,
            dmxOutputRate: dataBytes[4],
        };
    }

    protected sendDmx(): Promise<void> {
        const fixtureDmxValues = this.fixtures.map((f) => f.getDmxValues());
        const dmxValues = Array(513).fill(0);
        for (let i = 0; i <= 512; i++) {
            dmxValues[i] = Math.max(...fixtureDmxValues.map((v) => v[i]));
        }
        return this.sendSerialMessage(SEND_DMX_PACKET_REQUEST_LABEL, dmxValues);
    }
}

if (require.main === module) {
    const mapper = new HapToDmxMapper([new LightmaxxLedBar('LED Bar', 1), new EuroliteTmh14('TMH 1', 21), new EuroliteTmh14('TMH 2', 41)]);
    mapper.initialize();
}
