import { WhereOptions, Op as WhereOp } from "sequelize";
import Manager from '../';
import Database from "../database";
import { RawField } from "./ModelParser";
import PluginManager from "./PluginManager";

const Ops = ['>', '<', '>=', '<=', '=', '!=', ':'] as const;
export type Op = typeof Ops[number];

export interface QuerySegment {
    keys: string[];
    ops: Op[];
    parse(segment: string): WhereOptions<any>;
}

const tokenize = (query: string) => {
    let buffer = '';
    let in_string = false;
    const tokens = [];

    for (let i = 0; i < query.length; i++) {
        const char = query[i];
        if (char === '"') {
            in_string = !in_string;
            continue;
        }
        if (char === ' ' && !in_string) {
            if (buffer.length > 0) {
                tokens.push(buffer);
                buffer = '';
            }
            continue;
        }
        buffer += char;
    }

    if (buffer.length > 0) tokens.push(buffer);
    return tokens;
}

const ensure_op = (type: RawField['type'], op: Op) => {
    switch (type) {
        case 'string':
        case 'text':
            return op === '=' || op === '!=' || op === ':' || op === '>';

        case 'integer':
        case 'float':
            return op === '=' || op === '!=' || op === '>' || op === '<' || op === '>=' || op === '<=';

        case 'boolean':
            return op === '=';

        case 'date':
            return op === '=' || op === '!=' || op === '>' || op === '<' || op === '>=' || op === '<=';

        default:
            if (type.startsWith('list')) return op === ':';
            return false;
    }
}

const fit_type = (field: RawField, initial: string) => {

    let value: any = initial;
    if (field.type === 'date') value = new Date(value) || Date.now();
    if (field.type === 'boolean') value = value === 'true' || value === '1';
    if (field.type === 'integer') value = parseInt(value);
    if (field.type === 'float') value = parseFloat(value);

    if (field.type.startsWith('list')) {
        value = value.split(',').map((v: string) => fit_type({ ...field, type: field.type.split('-')[1] as RawField['type'] }, v));
    }

    return value;
}

export default async function ParseQuery(query: string, page: number = 0) {

    const ignored: string[] = [];

    const tokens: Array<{ key: string, value: string, op: Op, plugin?: QuerySegment, field?: RawField }> = tokenize(query)
        .filter(t => {
            // Ensure an operator is present
            for (const op of Ops) if (t.includes(op)) return true;
            ignored.push(t);
            return false;
        })
        .map(t => {
            // Fetch information
            const op = Ops.find(op => t.includes(op)) as Op;
            const [key, value] = t.split(op);
            return { key, value, op };
        })
        .map(t => {
            // Fetch field and plugin associations
            const plugin = PluginManager.query_plugins.find(p => p.keys.includes(t.key) && p.ops.includes(t.op));

            let field = Manager.get_model_field(t.key);
            if (field && !ensure_op(field?.type, t.op)) field = undefined;

            return { ...t, field, plugin };
        })
        .filter(t => {
            // Ensure a field or plugin is present
            if (t.field || t.plugin) return true;
            ignored.push(t.key + t.op + t.value);
            return false;
        });

    const field_where: WhereOptions[] = tokens
        .filter(t => t.field)
        .map(t => {

            if (!t.field) throw '?';
            const name = t.field.mapped_name ?? t.field.name;
            let value = fit_type(t.field, t.value);

            if (t.field.type === 'string' || t.field.type === 'text') {
                if (t.op === ':') return { [name]: { [WhereOp.iLike]: `%${value}%` } };
                if (t.op === '=') return { [name]: value };
            }

            if (t.field.type === 'integer' || t.field.type === 'float') {
                if (t.op === '=') return { [name]: value };
                if (t.op === '>') return { [name]: { [WhereOp.gt]: value } };
                if (t.op === '<') return { [name]: { [WhereOp.lt]: value } };
                if (t.op === '>=') return { [name]: { [WhereOp.gte]: value } };
                if (t.op === '<=') return { [name]: { [WhereOp.lte]: value } };
                if (t.op === '!=') return { [name]: { [WhereOp.ne]: value } };
            }

            if (t.field.type === 'boolean') {
                if (t.op === '=') return { [name]: value };
                if (t.op === '!=') return { [name]: { [WhereOp.ne]: value } };
            }

            if (t.field.type === 'date') {
                if (t.op === '=') return { [name]: value };
                if (t.op === '>') return { [name]: { [WhereOp.gt]: value } };
                if (t.op === '<') return { [name]: { [WhereOp.lt]: value } };
                if (t.op === '>=') return { [name]: { [WhereOp.gte]: value } };
                if (t.op === '<=') return { [name]: { [WhereOp.lte]: value } };
            }

            if (t.field.type.startsWith('list')) {
                if (t.op === ':') return { [name]: { [WhereOp.contains]: value } };
            }

        }) as WhereOptions[];

    const plugin_where: WhereOptions[] = tokens
        .filter(t => t.plugin)
        .map(t => t.plugin!.parse(t.value));

    const where = { ...Object.assign({}, ...field_where), ...Object.assign({}, ...plugin_where) };
    const results = await (await Database.get()).models.Items.findAll({ where: {[WhereOp.and]: where}, limit: 40, offset: page * 40 })
    
    return { ignored, results }

}