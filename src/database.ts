import { join } from 'path';
import { Sequelize } from 'sequelize';

// Export singleton instance of Sequelize
export default new class Database {
    
    public waiting: ((connection: Sequelize) => void)[] = [];
    public ready = false;

    public connection = new Sequelize('surveil', 'tascord', 'Teacher22', {
        host: 'localhost',
        dialect: 'postgres',
        logging: false,
      });

    constructor() {
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