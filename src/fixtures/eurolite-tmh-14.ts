import { Fixture } from '../fixture';
import { Characteristic, Service } from 'hap-nodejs';
import { performance } from 'perf_hooks';
import * as colorConvert from 'color-convert';

type EuroliteTmh14Properties = {
    on: boolean;
    brightness: number;
    hue: number;
    saturation: number;
    pan: number;
    tilt: number;
    zoom: number;
    effectEnabled: boolean;
};

export class EuroliteTmh14 extends Fixture<EuroliteTmh14Properties> {
    protected static nextEffectOffset = 0;
    protected readonly effectOffset;

    protected properties = {
        on: false,
        brightness: 100,
        hue: 0,
        saturation: 0,
        pan: 0,
        tilt: 0,
        zoom: 50,
        effectEnabled: false,
    };

    constructor(name: string, channel: number) {
        super(name, channel);
        this.effectOffset = EuroliteTmh14.nextEffectOffset;
        EuroliteTmh14.nextEffectOffset++;
    }

    public getHapService(): Service {
        const s = new Service.Lightbulb(this.name, 'channel_' + this.channel);
        this.addCharacteristic(s, Characteristic.On, 'on');
        this.addCharacteristic(s, Characteristic.Brightness, 'brightness');
        this.addCharacteristic(s, Characteristic.Hue, 'hue');
        this.addCharacteristic(s, Characteristic.Saturation, 'saturation');
        this.addCharacteristic(s, Characteristic.TargetHorizontalTiltAngle, 'pan');
        this.addCharacteristic(s, Characteristic.TargetVerticalTiltAngle, 'tilt');
        this.addCharacteristic(s, Characteristic.OpticalZoom, 'zoom');
        this.addCharacteristic(s, Characteristic.AudioFeedback, 'effectEnabled');
        return s;
    }

    public getDmxValues(): number[] {
        const [r, g, b] = colorConvert.hsv.rgb([this.properties.hue, this.properties.saturation, 100]);
        const [brightness] = this.toDmxValue(this.properties.brightness, 0, 100);

        const t = performance.now() / 1000;
        const tt = 2 * Math.PI * t;
        const effectEnabled = this.properties.on && this.properties.effectEnabled ? 1 : 0;
        const effectColors = [0, 19, 0, 33, 0, 89, 0, 66, 0, 76, 0, 12, 0, 81, 0, 105];
        const colorEffect = effectColors[(Math.floor(t * 2) + this.effectOffset * 5) % effectColors.length] * effectEnabled;
        const panEffect = 40 * Math.sin(tt / 3 + (this.effectOffset * Math.PI) / 2) * effectEnabled;
        const tiltEffect = 40 * Math.cos(tt / 3 + (this.effectOffset * Math.PI) / 2) * effectEnabled;

        const [panCoarse, panFine] = this.toDmxValue(this.properties.pan + panEffect, -270, 270);
        const [tiltCoarse, tiltFine] = this.toDmxValue(this.properties.tilt + tiltEffect, -95, 95);
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
        dmxValues[this.channel + 12] = colorEffect; // Color Wheel
        dmxValues[this.channel + 13] = 150; // Color Speed
        dmxValues[this.channel + 14] = 0; // Program
        dmxValues[this.channel + 15] = 0; // Program Speed
        dmxValues[this.channel + 16] = 0; // Reset
        return dmxValues;
    }
}
