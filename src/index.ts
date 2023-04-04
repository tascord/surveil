console.clear();

import { existsSync } from "fs";
import { join } from "path";
import DataMapper, { Extension } from "./classes/DataMapper";
import ModelParser, { RawField } from "./classes/ModelParser";
import Database from "./database";
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

    public run(exported: { data: Array<{ [key: string]: any }>, fields: RawField[], overwrite: boolean, skip: boolean, port: number, extensions: Extension[] }) {

        const { fields, data, overwrite, skip, port } = exported;
        this.model_parser = new ModelParser(data, overwrite);
        this.model_parser.parse(fields, skip);

        server(port, fields).then(([app, router]) => {
            for (const extension of exported.extensions) {
                extension(() => Database.get(), router, app);
            }
        });
    }

    public get_model_field(name: string) {
        name = name.toLowerCase();
        return this.model_shape.find(field => field.mapped_name?.toLowerCase() === name || (!field.mapped_name && field.name.toLowerCase() === name) || (
            field.alias && (
                Array.isArray(field.alias) ? field.alias.some(alias => alias.toLowerCase() === name) : field.alias?.toLowerCase() === name
            )
        ));
    }

}

export default new Manager();