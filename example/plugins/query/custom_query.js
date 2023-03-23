const { CreateQueryPlugin } = require('surveil/plugins');

module.exports = CreateQueryPlugin()
    .keys(['query keys'])
    .ops(['query operators'])
    .parse(segment => {

        // ...

        return {
            // Where Clause
        }

    })
