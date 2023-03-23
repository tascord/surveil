const { CreateQueryPlugin } = require('surveil');

module.exports = new CreateQueryPlugin()
    .keys(['query keys'])
    .ops(['query operators'])
    .parse(segment => {

        // ...

        return {
            // Where Clause
        }

    })
