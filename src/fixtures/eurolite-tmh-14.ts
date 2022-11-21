import { Fixture } from '../fixture';
import { Characteristic, Service } from 'hap-nodejs';
import * as colorConvert from 'color-convert';

type EuroliteTmh14Properties = {
    on: boolean;
    brightness: number;
    hue: number;
    saturation: number;
    pan: number;
    tilt: number;
    zoom: number;
};

export class EuroliteTmh14 extends Fixture<EuroliteTmh14Properties> {
    protected properties = {
        on: false,
        brightness: 100,
        hue: 0,
        saturation: 0,
        pan: 0,
        tilt: 0,
        zoom: 50,
    };

    public getHapService(): Service {
        const s = new Service.Lightbulb(this.name, 'channel_' + this.channel);
        this.addCharacteristic(s, Characteristic.On, 'on');
        this.addCharacteristic(s, Characteristic.Brightness, 'brightness');
        this.addCharacteristic(s, Characteristic.Hue, 'hue');
        this.addCharacteristic(s, Characteristic.Saturation, 'saturation');
        this.addCharacteristic(s, Characteristic.TargetHorizontalTiltAngle, 'pan');
        this.addCharacteristic(s, Characteristic.TargetVerticalTiltAngle, 'tilt');
        this.addCharacteristic(s, Characteristic.OpticalZoom, 'zoom');
        return s;
    }

    public getDmxValues(): number[] {
        const [r, g, b] = colorConvert.hsv.rgb([this.properties.hue, this.properties.saturation, 100]);
        const [brightness] = this.toDmxValue(this.properties.brightness, 0, 100);
        const [panCoarse, panFine] = this.toDmxValue(this.properties.pan, -270, 270);
        const [tiltCoarse, tiltFine] = this.toDmxValue(this.properties.tilt, -95, 95);
        const [zoom] = this.toDmxValue(this.properties.zoom, 0, 100);

        const dmxValues = super.getDmxValues();
        dmxValues[this.channel] = panCoarse;
        dmxValues[this.channel + 1] = panFine;
        dmxValues[this.channel + 2] = tiltCoarse;
        dmxValues[this.channel + 3] = tiltFine;
        dmxValues[this.channel + 4] = 0; // Movement Speed
        dmxValues[this.channel + 5] = 0; // Strobe
        dmxValues[this.channel + 6] = this.properties.on ? brightness : 0;
        dmxValues[this.channel + 7] = zoom;
        dmxValues[this.channel + 8] = r;
        dmxValues[this.channel + 9] = g;
        dmxValues[this.channel + 10] = b;
        dmxValues[this.channel + 11] = 0; // White
        dmxValues[this.channel + 12] = 0; // Color Wheel
        dmxValues[this.channel + 13] = 0; // Color Speed
        dmxValues[this.channel + 14] = 0; // Program
        dmxValues[this.channel + 15] = 0; // Program Speed
        dmxValues[this.channel + 16] = 0; // Reset
        return dmxValues;
    }
}
