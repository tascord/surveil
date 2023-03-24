console.clear();

import { existsSync } from "fs";
import { join } from "path";
import DataMapper from "./classes/DataMapper";
import ModelParser, { RawField } from "./classes/ModelParser";
import server from "./server";

// Defaults
export { default as DataMapper } from "./classes/DataMapper";

class Manager {

    private model_parser: ModelParser;
    private model_shape: RawField[];

    constructor() {
        this.model_parser = new ModelParser([]);

        const mapper_location = join(process.cwd(), 'mapper.js');
        if (!existsSync(mapper_location)) throw new Error('Mapper file not found');

        const mapper = require(mapper_location) as DataMapper;
        const data = mapper.export();

        this.model_shape = data.fields;
        this.run(data);
    }

    public run(exported: { data: Array<{ [key: string]: any }>, fields: RawField[], overwrite: boolean, skip: boolean, port: number }) {

        const { fields, data, overwrite, skip, port } = exported;
        this.model_parser = new ModelParser(data, overwrite);
        this.model_parser.parse(fields, skip);

        server(port, fields);
    }

    public get_model_field(name: string) {
        return this.model_shape.find(field => field.mapped_name === name || (!field.mapped_name && field.name === name) || field.alias?.includes(name));
    }

}

export default new Manager();