import { createServer } from "http";
import { createApp, createRouter, eventHandler, getQuery, readBody, toNodeListener } from "h3";
import ParseQuery from "./classes/QueryParser";

export default async function (port: number) {

    const app = createApp();
    const router = createRouter();

    router.post("/query", eventHandler(async event => {

        let page_query = getQuery(event).page;
        if (Array.isArray(page_query)) page_query = page_query[0];
        
        let page = parseInt(page_query||'') || 0;
        return ParseQuery((await readBody(event)).trim(), page);
    }));

    app.use(router);

    const server = createServer(toNodeListener(app));
    server.listen(port, () => console.log("• Server started on port " + port));

}