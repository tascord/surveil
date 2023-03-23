import { DataMappingStrategy } from "../classes/DataMapper";

class PluginDataMappingStrategy {
    
    private _type: DataMappingStrategy['type'] = '';
    private _parse: DataMappingStrategy['parse'] = () => [];

    public type(type: DataMappingStrategy['type']) {
        this._type = type;
        return this;
    }

    public parse(parse: DataMappingStrategy['parse']) {
        this._parse = parse;
        return this;
    }

    public export(): DataMappingStrategy {
        return {
            type: this._type,
            parse: this._parse
        };
    }

}

export const CreateDataMapper = () => new PluginDataMappingStrategy();