import { readdirSync, statSync } from "fs";
import { resolve } from "path";
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
        console.log('• Loading plugins')
        for (const subfolder of plugins) {

            if (FolderMap[subfolder] === undefined) continue;
            if (!statSync(`./plugins/${subfolder}`).isDirectory()) continue;

            const files = readdirSync(`./plugins/${subfolder}`).filter(file => file.endsWith('.js'));
            for (const file of files) {
                try {
                    const plugin = require(resolve(`./plugins/${subfolder}/${file}`));
                    if (!plugin) throw new Error('Invalid plugin');
                    if (!plugin.export || typeof plugin.export !== 'function') throw new Error('Invalid plugin export');

                    this[FolderMap[subfolder] as keyof PluginManager].push(plugin.export());
                    console.log(`• Loaded plugin: ${subfolder}/${file}.`);

                } catch (err) {
                    console.log(`• Unable to load plugin: ${subfolder}/${file}`);
                    console.log('\t' + (err as Error).message);
                }
            }

        }

    }

}

export default new PluginManager();