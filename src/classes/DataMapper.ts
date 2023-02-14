import { readFileSync } from "fs";
import { RawField } from "./ModelParser";
import PluginManager from "./PluginManager";

export interface DataMappingStrategy {
    type: string;
    parse(data: Buffer): Array<{ [key: string]: any }>;
}

export default class DataMapper {

    private readonly _file_location: string;
    private readonly _strategy: 'json' | string;
    private _fields: RawField[] = [];
    private _overwrite = false;

    constructor(file_location: string, strategy: 'json' | string) {
        this._file_location = file_location;
        this._strategy = strategy;
    }

    public map(
        name: RawField['name'],
        type: RawField['type'],
        mapped_name?: RawField['mapped_name'],
        parser?: RawField['parser'],
        allow_null?: RawField['allow_null'],
        unique?: RawField['unique']
    ) {

        this._fields.push({
            name,
            type,
            mapped_name,
            parser,
            allow_null,
            unique
        });

        return this;
    }

    public overwrite(value = true) {
        this._overwrite = value;
        return this;
    }

    public export() {

        const buffer = readFileSync(this._file_location);
        let data;

        if (this._strategy === 'json') data = JSON.parse(buffer.toString());
        else {
            const plugin = PluginManager.data_plugins.find(plugin => plugin.type === this._strategy)
            if (!plugin) throw new Error(`Invalid data mapping strategy: ${this._strategy}`);
            data = plugin.parse(buffer);
        }

        return {
            data,
            overwrite: this._overwrite,
            fields: this._fields
        };
    }

}