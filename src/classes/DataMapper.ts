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
    private _skip = false;
    private _port = 3000;

    constructor(file_location: string, strategy: 'json' | string) {
        this._file_location = file_location;
        this._strategy = strategy;
    }

    public map(
        name: RawField['name'],
        type: RawField['type'],
        options: {
            mapped_name?: RawField['mapped_name'],
            parser?: RawField['parser'],
            allow_null?: RawField['allow_null'],
            unique?: RawField['unique'],
            alias?: RawField['alias'],
            hidden?: RawField['hidden']
        } = {}
    ) {

        const {
            mapped_name,
            parser,
            allow_null,
            unique,
            alias,
            hidden
        } = options;

        this._fields.push({
            name,
            type,
            mapped_name,
            parser,
            allow_null,
            unique,
            alias,
            hidden
        });

        return this;
    }

    public overwrite(value = true) {
        this._overwrite = value;
        return this;
    }

    public skip(value = false) {
        this._skip = value;
        return this;
    }

    public port(value = 3000) {
        this._port = value;
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
            skip: this._skip,
            fields: this._fields,
            port: this._port,
        };
    }

}