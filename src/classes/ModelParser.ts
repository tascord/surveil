import { DataTypes, ModelAttributes } from "sequelize";
import Database from "../database";

type GenericFieldType = 'integer' | 'float' | 'string' | 'boolean' | 'date' | 'text' | 'json';
export type FieldType = GenericFieldType | `list-${GenericFieldType}`;
type FieldParser = (value: string) => any;

export type RawField = {
    type: FieldType;
    name: string;
    mapped_name?: string;
    parser?: FieldParser;
    allow_null?: boolean;
    unique?: boolean;
    alias?: string[];
    hidden?: boolean;
}

const map_type = (type: FieldType): DataTypes.AbstractDataTypeConstructor | DataTypes.ArrayDataType<any> => {
    switch (type) {
        case 'integer':
            return DataTypes.INTEGER;
        case 'float':
            return DataTypes.FLOAT;
        case 'string':
            return DataTypes.STRING;
        case 'boolean':
            return DataTypes.BOOLEAN;
        case 'date':
            return DataTypes.DATE;
        case 'text':
            return DataTypes.TEXT;
        case 'json':
            return DataTypes.JSON;
        default:
            if (type.startsWith('list-')) {
                const list_type = type.split('-')[1] as GenericFieldType;
                return DataTypes.ARRAY(map_type(list_type));
            } else {
                throw new Error(`Invalid field type: ${type}`);
            }
    }
}

export default class ModelParser {

    private json: Array<{ [key: string]: any }>;
    private overwrite: boolean;

    constructor(json: Array<{ [key: string]: any }>, overwrite = false) {
        this.json = json;
        this.overwrite = overwrite;
    }

    public async model(raw_fields: RawField[]) {

        // Check criteria
        if (!raw_fields.some(field => field.name === 'id' || field.mapped_name == 'id')) throw new Error('No \'id\' field specified.');

        // Define model
        const model: ModelAttributes = {};
        for (const raw_field of raw_fields) {
            model[raw_field.mapped_name ?? raw_field.name] = {
                type: map_type(raw_field.type),
                allowNull: raw_field.allow_null ?? true,
                unique: raw_field.unique ?? false,
                primaryKey: raw_field.name === 'id' || raw_field.mapped_name === 'id',
            };
        }

        // Commit model to database
        const Items = (await Database.get()).define('Items', model);
        await Items.sync({ alter: true });

        return Items;

    }

    public async parse(raw_fields: RawField[], skip: boolean) {

        // Create model
        const Item = await this.model(raw_fields);

        // Skip if requested
        if (skip) return;

        // Start transaction
        const transaction = await (await Database.get()).transaction();

        // if(!this.overwrite) return;

        // Parse and create data
        let count = 0; let skipped = 0;
        console.log(`• Parsing ${this.json.length} items.`)

        for (const item of this.json) {
            try {

                const exists = await Item.findByPk(item.id, { transaction });

                if (!this.overwrite && exists) {
                    count++;

                    if (skipped === 0) console.log(`• Skipping item #${count} (id: ${item.id})`);
                    else {
                        process.stdout.clearLine(0);
                        process.stdout.cursorTo(0);
                        process.stdout.write(`  + (${skipped})`);
                    }


                    skipped++;
                    continue;
                } else if (skipped > 0) {
                    skipped = 0;
                    process.stdout.write('\n');
                }

                // Parse item
                const parsed_item: { [key: string]: any } = {};
                for (const raw_field of raw_fields) {
                    parsed_item[raw_field.mapped_name ?? raw_field.name] = raw_field.parser ? raw_field.parser(item[raw_field.name]) : item[raw_field.name];
                }

                // Create item
                if(!exists) await Item.create(parsed_item, { transaction });
                else await Item.update(parsed_item, { where: { id: item.id }, transaction });

                count++;

            } catch (err) {

                if (skipped > 0) {
                    skipped = 0;
                    process.stdout.write('\n');
                }

                // Log
                console.log(`Error parsing item #${count}. Rolling back.\n`);
                console.log(err);

                // Rollback transaction
                await transaction.rollback();
                process.exit(1);

            }
        }

        if (skipped > 0) {
            skipped = 0;
            process.stdout.write('\n');
        }

        // Commit transaction
        await transaction.commit();
        console.log(`• Committed ${count} items.`)

    }

}