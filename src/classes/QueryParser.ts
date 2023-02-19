import { WhereOptions, Op as WhereOp } from "sequelize";
import Manager from '../';
import { RawField } from "./ModelParser";
import PluginManager from "./PluginManager";
import Database from "../database";

const Ops = ['>', '<', '>=', '<=', '=', '!=', ':', '!:'] as const;
export type Op = typeof Ops[number];

const Keywords = ['and', 'or'] as const;
export type Keyword = typeof Keywords[number];

export interface QuerySegment {
    keys: string[];
    ops: Op[];
    parse(segment: string): WhereOptions<any>;
}

const tokenize = (query: string) => {
    let buffer = '';
    let in_string = false;
    let tokens: (string | string[])[] = [];

    for (let i = 0; i < query.length; i++) {
        const char = query[i];

        // Sub-parsing
        if (char === '(' && !in_string) {

            if (buffer.length > 0) {
                tokens.push(buffer);
                buffer = '';
            }

            let slice_buffer = '';
            let balance = -1;
            for (let j = i + 1; i < query.length; j += 1) {
                if (query[j] === '(') balance -= 1;
                if (query[j] === ')') balance += 1;

                if (balance === 0) {
                    i = j;
                    break;
                };

                if (!query[j]) throw 'Unbalanced parentheses';
                slice_buffer += query[j];
            }

            tokens.push(tokenize(slice_buffer) as string[]);
            continue;
        }

        // Quotations
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
            return op === '=' || op === '!=' || op === ':' || op === '!:' || op === '>';

        case 'integer':
        case 'float':
            return op === '=' || op === '!=' || op === '>' || op === '<' || op === '>=' || op === '<=';

        case 'boolean':
            return op === '=';

        case 'date':
            return op === '=' || op === '!=' || op === '>' || op === '<' || op === '>=' || op === '<=';

        default:
            if (type.startsWith('list')) return op === ':' || op === '>=' || op === '=' || op === '!=';
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

const keyword_op = (keyword: Keyword) => {
    switch (keyword) {
        case 'and': return WhereOp.and;
        case 'or': return WhereOp.or;
    }
}

const parse_where = (raw_token: string): false | WhereOptions => {

    // Ensure an operator is present
    if (!Ops.some(op => raw_token.includes(op))) return false;

    // Split tokens
    let buffer = '';
    let [op_key, op, valid, op_value] = ['', '' as Op, false, ''];
    for (let i = 0; i < raw_token.length; i++) {
        const char = raw_token[i];

        if (Ops.includes(char as Op)) {
            if (valid) {
                op += char;
                continue;
            } else {
                valid = true;
                op_key = buffer;
                op = char as Op;
            }
        } else {
            if (!valid) buffer += char;
            else {
                op_value = raw_token.slice(op_key.length + op.length);
            }
        }

    }

    // Fetch field and plugin associations
    const plugin = PluginManager.query_plugins.find(p => p.keys.includes(op_key) && p.ops.includes(op));

    let field = Manager.get_model_field(op_key);
    if (field && !ensure_op(field?.type, op)) field = undefined;

    // Ensure a field or plugin is present
    if (!field && !plugin) return false;

    // Field where
    if (field) {

        const name = field.mapped_name ?? field.name;
        let value = fit_type(field, op_value);

        if (field.type === 'string' || field.type === 'text') {
            if (op === ':') return { [name]: { [WhereOp.iLike]: `%${value}%` } };
            if (op === '!:') return { [name]: { [WhereOp.notILike]: `%${value}%` } };
            if (op === '=') return { [name]: value };
        }

        if (field.type === 'integer' || field.type === 'float') {
            if (op === '=') return { [name]: value };
            if (op === '>') return { [name]: { [WhereOp.gt]: value } };
            if (op === '<') return { [name]: { [WhereOp.lt]: value } };
            if (op === '>=') return { [name]: { [WhereOp.gte]: value } };
            if (op === '<=') return { [name]: { [WhereOp.lte]: value } };
            if (op === '!=') return { [name]: { [WhereOp.ne]: value } };
        }

        if (field.type === 'boolean') {
            if (op === '=') return { [name]: value };
            if (op === '!=') return { [name]: { [WhereOp.ne]: value } };
        }

        if (field.type === 'date') {
            if (op === '=') return { [name]: value };
            if (op === '>') return { [name]: { [WhereOp.gt]: value } };
            if (op === '<') return { [name]: { [WhereOp.lt]: value } };
            if (op === '>=') return { [name]: { [WhereOp.gte]: value } };
            if (op === '<=') return { [name]: { [WhereOp.lte]: value } };
        }

        if (field.type.startsWith('list')) {
            if (op === ':') return { [name]: { [WhereOp.contains]: value } };
            if (op === '=') return { [name]: { [WhereOp.eq]: value } };
            if (op === '!=') return { [name]: { [WhereOp.ne]: value } };

            if (op === '>=') return {
                [WhereOp.and]: [
                    { [name]: { [WhereOp.contains]: value } },
                    { [name]: { [WhereOp.gt]: value } }
                ]
            };

        }

    }

    // Plugin where
    if (plugin) {
        return plugin.parse(op_value);
    }

    return false;
}

const parse_tokens = (tokens: (string | string[])[]): { where: WhereOptions[], ignored: string[] } => {


    let ignored: string[] = [];
    let calculated: (WhereOptions | Keyword | null)[] = [];
    let calculated_where: WhereOptions[] = [];

    for (const token of tokens) {

        // Subgroups are part of a pre-pass
        if (Array.isArray(token)) {
            const { where, ignored: sub_ignored } = parse_tokens(token);
            calculated = [...calculated, ...where];
            ignored = [...ignored, ...sub_ignored];
            continue;
        }

        // Keywords are part of a second pass
        if (Keywords.includes(token as Keyword)) {
            calculated.push(token as Keyword);
            continue;
        }

        const where = parse_where(token);
        if (!where) ignored.push(token);
        else calculated.push(where);
    }

    // Second pass
    for (let i = 0; i < calculated.length; i++) {

        const token = calculated[i];
        let [a, b] = [calculated[i - 1] || calculated_where[calculated_where.length - 1], calculated[i + 1]];
        const real_a = calculated[i - 1];

        if (Keywords.includes(token as Keyword)) {

            if (!a || !b) {
                ignored.push(token as string);
                calculated[i] = null;
                continue;
            }

            // Extending previous keyword where
            if (!real_a) calculated_where.pop();

            calculated_where.push({
                [keyword_op(token as Keyword)]: [a, b]
            });

            // Consume used tokens
            calculated[i - 1] = null;
            calculated[i + 1] = null;
            calculated[i] = null;

        } else {

            if (real_a) {

                // Not used in a keyword, so it's a standalone where
                calculated_where = [
                    ...calculated_where.slice(0, i - 1),
                    real_a as WhereOptions,
                    ...calculated_where.slice(i - 1)
                ]

                // Consume used token
                calculated[i - 1] = null;

            }

        }

    };

    return { where: calculated_where, ignored };

}

export default async function ParseQuery(query: string, page: number = 0) {

    try {
        const { where: parsed_where, ignored } = parse_tokens(tokenize(query));

        let where = { [WhereOp.and]: parsed_where }

        const result_count = await (await Database.get()).models.Items.count({ where });
        const results = await (await Database.get()).models.Items.findAll({ where, limit: 40, offset: page * 40, order: [['name', 'ASC']] });

        return { ignored, count: result_count, results };
    } catch (err) {
        return { error: err }
    }

}