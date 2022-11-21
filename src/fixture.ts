import { CharacteristicValue, WithUUID } from 'hap-nodejs/dist/types';
import { Characteristic, CharacteristicEventTypes, Service } from 'hap-nodejs';

export abstract class Fixture<FixtureProperties extends { [property: string]: CharacteristicValue } = {}> {
    public constructor(public readonly name: string, public readonly channel: number, public changeCallback: () => void = () => {}) {}

    protected abstract properties: FixtureProperties;

    public abstract getHapService(): Service;

    protected addCharacteristic(service: Service, constructor: WithUUID<{ new (): Characteristic }>, property: keyof FixtureProperties) {
        const characteristic = service?.getCharacteristic(constructor);
        characteristic?.on(CharacteristicEventTypes.GET, (callback) => {
            callback(undefined, this.properties[property]);
        });
        characteristic?.on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback) => {
            this.properties[property] = value as never;
            this.changeCallback();
            callback();
        });
    }

    public getDmxValues(): number[] {
        return Array(513).fill(0);
    }
}
