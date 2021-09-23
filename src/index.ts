import SerialPort from 'serialport';
import { Accessory, Categories, Characteristic, CharacteristicEventTypes, Service, uuid } from 'hap-nodejs';
import { WithUUID } from 'hap-nodejs/dist/types';
import * as colorConvert from 'color-convert';

const START_OF_MESSAGE_DELIMITER = 0x7e;
const SEND_DMX_PACKET_REQUEST_LABEL = 6;
const END_OF_MESSAGE_DELIMITER = 0xe7;

class HapToDmxMapper {
    protected light?: Service;
    protected accessory?: Accessory;
    protected serial?: SerialPort;

    protected on = false;
    protected brightness = 100;
    protected hue = 0;
    protected saturation = 0;

    public async initialize() {
        await this.initializeSerial();
        this.initializeLight();
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
        this.serial = new SerialPort(path);
        this.sendSerial();
    }

    protected initializeLight() {
        this.light = new Service.Lightbulb('LED Bar');

        const addCharacteristic = (
            constructor: WithUUID<{ new (): Characteristic }>,
            property: 'on' | 'brightness' | 'hue' | 'saturation',
        ) => {
            const characteristic = this.light?.getCharacteristic(constructor);
            characteristic?.on(CharacteristicEventTypes.GET, (callback) => {
                callback(undefined, this[property]);
            });
            characteristic?.on(CharacteristicEventTypes.SET, (value, callback) => {
                this[property] = value as never;
                this.sendSerial();
                callback();
            });
        };

        addCharacteristic(Characteristic.On, 'on');
        addCharacteristic(Characteristic.Brightness, 'brightness');
        addCharacteristic(Characteristic.Hue, 'hue');
        addCharacteristic(Characteristic.Saturation, 'saturation');
    }

    protected initializeAccessory() {
        const accessoryUuid = uuid.generate('com.fabian-scheidt.hap-dmx');
        this.accessory = new Accessory('HAP-DMX LED-Bar', accessoryUuid);
        this.accessory.addService(this.light!);

        this.accessory.publish({
            username: '46:f8:33:74:ff:30',
            pincode: '211-51-758',
            category: Categories.LIGHTBULB,
        });
    }

    protected sendSerialMessage(label: number, data: number[], callback?: (error: Error | null | undefined, bytesWritten: number) => void) {
        const lengthLsb = data.length & 0xff;
        const lengthMsb = data.length >> 8;

        this.serial?.write([START_OF_MESSAGE_DELIMITER, label, lengthLsb, lengthMsb, ...data, END_OF_MESSAGE_DELIMITER], callback);
    }

    protected sendSerial() {
        const [r, g, b] = colorConvert.hsv.rgb([this.hue, this.saturation, 100]);
        const dmxValues = Array(513).fill(0);

        // LightmaXX LED Color Bar
        dmxValues[1] = 30;
        dmxValues[2] = this.on ? Math.round((this.brightness / 100) * 255) : 0;
        dmxValues[3] = 0;
        dmxValues[4] = r;
        dmxValues[5] = g;
        dmxValues[6] = b;

        this.sendSerialMessage(SEND_DMX_PACKET_REQUEST_LABEL, dmxValues);
    }
}

if (require.main === module) {
    const mapper = new HapToDmxMapper();
    mapper.initialize();
}
