import { readdirSync, statSync } from "fs";
import { DataMappingStrategy } from "./DataMapper";
import { QuerySegment } from "./QueryParser";

const FolderMap: { [key: string]: keyof PluginManager } = {
    query: 'query_plugins',
    data: 'data_plugins'
}

class PluginManager {

    public readonly query_plugins: Array<QuerySegment>;
    public readonly data_plugins: Array<DataMappingStrategy>;

    constructor() {
        this.query_plugins = [];
        this.data_plugins = [];

        this.locate();
    }

    private locate() {

        const dir = readdirSync('./');
        if (!dir.includes('plugins')) return;

        const plugins = readdirSync('./plugins');
        for (const subfolder of plugins) {

            if (FolderMap[subfolder] === undefined) continue;
            if (statSync(`./plugins/${subfolder}`).isDirectory() === false) continue;

            const files = readdirSync(`./plugins/${subfolder}`).filter(file => file.endsWith('.js'));
            for (const file of files) {
                try {
                    const plugin = require(`../plugins/${subfolder}/${file}`);                    
                    this[FolderMap[subfolder] as keyof PluginManager].push(plugin.default);
                    console.log(`• Loaded plugin: ${plugin.name}.`);

                } catch (err) {
                    console.log(`Unable to load plugin: ${file}.\n`);
                    console.log(err); 
                }
            }

        }

    }

}

export default new PluginManager();