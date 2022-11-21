import { Fixture } from '../fixture';
import { Characteristic, Service } from 'hap-nodejs';
import * as colorConvert from 'color-convert';

type LightmaxxLedBarProperties = {
    on: boolean;
    brightness: number;
    hue: number;
    saturation: number;
};

export class LightmaxxLedBar extends Fixture<LightmaxxLedBarProperties> {
    protected properties = {
        on: false,
        brightness: 100,
        hue: 0,
        saturation: 0,
    };

    public getHapService(): Service {
        const s = new Service.Lightbulb(this.name, 'channel_' + this.channel);
        this.addCharacteristic(s, Characteristic.On, 'on');
        this.addCharacteristic(s, Characteristic.Brightness, 'brightness');
        this.addCharacteristic(s, Characteristic.Hue, 'hue');
        this.addCharacteristic(s, Characteristic.Saturation, 'saturation');
        return s;
    }

    public getDmxValues(): number[] {
        const [r, g, b] = colorConvert.hsv.rgb([this.properties.hue, this.properties.saturation, 100]);
        const [brightness, _] = this.toDmxValue(this.properties.brightness, 0, 100);

        const dmxValues = super.getDmxValues();
        dmxValues[this.channel] = 30;
        dmxValues[this.channel + 1] = this.properties.on ? brightness : 0;
        dmxValues[this.channel + 2] = 0;
        dmxValues[this.channel + 3] = r;
        dmxValues[this.channel + 4] = g;
        dmxValues[this.channel + 5] = b;
        return dmxValues;
    }
}
