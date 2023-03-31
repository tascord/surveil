const { DataMapper } = require('surveiltg');

module.exports = new DataMapper('./data.json', 'json')
    // .map('field', 'type', { })
