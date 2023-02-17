import { Sequelize } from 'sequelize';
import { config } from "dotenv";

export default new class Database {

    public waiting: ((connection: Sequelize) => void)[] = [];
    public ready = false;

    public connection: Sequelize;

    constructor() {
        config();
        this.connection = new Sequelize(process.env.post_database!, process.env.post_username!, process.env.post_password!, {
            host: process.env.post_host ?? 'localhost',
            dialect: 'postgres',
            logging: false,
        });

        this.connection.sync().then(() => {
            this.ready = true;
            this.waiting.forEach(resolve => resolve(this.connection));
            this.waiting = [];
        });
    }

    public get() {
        return new Promise<Sequelize>(resolve => {
            if (this.ready) resolve(this.connection);
            else this.waiting.push(resolve);
        })
    }

}