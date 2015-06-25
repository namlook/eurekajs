
module.exports = {
    properties: {
        _owner: {
            type: 'string'
        },
        _scope: {
            type: 'string',
            multi: true
        },
        title: {
            type: 'string'
        },
        isSecret: {
            type: 'boolean'
        }
    }
};