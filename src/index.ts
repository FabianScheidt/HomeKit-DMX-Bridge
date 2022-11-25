import { SerialPort } from 'serialport';
import { Accessory, Categories, uuid } from 'hap-nodejs';
import { LightmaxxLedBar } from './fixtures/lightmaxx-led-bar';
import { Fixture } from './fixture';

const START_OF_MESSAGE_DELIMITER = 0x7e;
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
        this.serial = new SerialPort({ path, baudRate: 115200 });
    }

    protected initializeAccessory() {
        const accessoryUuid = uuid.generate('com.fabian-scheidt.hap-dmx');
        this.accessory = new Accessory('HAP-DMX LED-Bar', accessoryUuid);
        for (const fixture of this.fixtures) {
            fixture.changeCallback = () => this.sendSerial();
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

    protected sendSerial(): Promise<void> {
        const fixtureDmxValues = this.fixtures.map((f) => f.getDmxValues());
        const dmxValues = Array(513).fill(0);
        for (let i = 0; i <= 512; i++) {
            dmxValues[i] = Math.max(...fixtureDmxValues.map((v) => v[i]));
        }
        return this.sendSerialMessage(SEND_DMX_PACKET_REQUEST_LABEL, dmxValues);
    }
}

if (require.main === module) {
    const mapper = new HapToDmxMapper([new LightmaxxLedBar('LED Bar', 1)]);
    mapper.initialize();
}
