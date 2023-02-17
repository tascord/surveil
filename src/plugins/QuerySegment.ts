import { QuerySegment } from "../classes/QueryParser";

class PluginQuerySegment {
    
    private _keys: QuerySegment['keys'] = [];
    private _ops: QuerySegment['ops'] = [];
    private _parse: QuerySegment['parse'] = () => ({});

    public keys(keys: QuerySegment['keys']) {
        this._keys = keys;
        return this;
    }

    public ops(ops: QuerySegment['ops']) {
        this._ops = ops;
        return this;
    }

    public parse(parse: QuerySegment['parse']) {
        this._parse = parse;
        return this;
    }

    public export(): QuerySegment {
        return {
            keys: this._keys,
            parse: this._parse,
            ops: this._ops
        };
    }

}

export const CreateQueryPlugin = () => new PluginQuerySegment;