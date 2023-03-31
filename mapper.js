const { DataMapper } = require('surveil');

module.exports = new DataMapper('./data.json', 'json')
    // .map('field', 'type', { })
