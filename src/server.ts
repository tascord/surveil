import { createServer } from "http";
import { App, createApp, createRouter, eventHandler, fromNodeMiddleware, getQuery, readBody, Router, toNodeListener } from "h3";
import ParseQuery, { Op } from "./classes/QueryParser";
import { RawField, FieldType } from "./classes/ModelParser";
import PluginManager from "./classes/PluginManager";
import Database from "./database";
import sequelize from "sequelize";

const OpMap: Array<[FieldType[], Op[]]> = [
    [['string', 'text'], ['=', '!=', ':', '!:', '>', '/', '!/']],
    [['integer', 'float'], ['=', '!=', '>', '<', '>=', '<=']],
    [['boolean'], ['=']],
    [['date'], ['=', '!=', '>', '<', '>=', '<=']],
    [[
        'list-string',
        'list-text',
        'list-integer',
        'list-float',
        'list-boolean',
        'list-date'
    ], [':', '>=', '=', '!=']]
];

type ComputedModelField = {
    name: string,
    ops: Op[],
    alias: string[]
}

export default async function (port: number, fields: RawField[]) {
    return new Promise<[App, Router]>(resolve => {
        const app = createApp();
        const router = createRouter();

        resolve([app, router]);

        router.get("/random", eventHandler(async () => {
            return await (await Database.get()).models.Items.findAll({ order: sequelize.fn('RANDOM'), limit: 1 });
        }));

        router.post("/query", eventHandler(async event => {

            let page_query = getQuery(event).page;
            if (Array.isArray(page_query)) page_query = page_query[0];

            let page = parseInt(page_query || '') || 0;
            return ParseQuery((await readBody(event)).trim(), page);

        }));

        router.get('/model', eventHandler(() => {
            const computed_fields: ComputedModelField[] = fields.filter(f => !f.hidden).map(f => ({
                name: f.mapped_name || f.name,
                ops: OpMap.find(([types]) => types.includes(f.type))?.[1] || [],
                alias: f.alias || []
            }));

            for (const plugin of PluginManager.query_plugins) {
                computed_fields.push({
                    name: plugin.keys[0],
                    ops: plugin.ops,
                    alias: plugin.keys.slice(1)
                });
            }

            return computed_fields;
        }));

        app.use(fromNodeMiddleware((i, o, n) => {
            o.setHeader('Access-Control-Allow-Origin', '*');
            o.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
            o.setHeader('Access-Control-Max-Age', '86400');
            o.setHeader('Access-Control-Allow-Headers', '*');

            if (i.method === 'OPTIONS') {
                o.writeHead(200);
                o.end();
                return;
            }

            n();
        }));

        app.use(router);

        const server = createServer(toNodeListener(app));
        server.listen(port, () => console.log("• Server started on port " + port));

    })
}