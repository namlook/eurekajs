
module.exports = {
    properties: {
        _owner: {
            type: 'string'
        },
        _scope: {
            type: 'array',
            items: 'string'
        },
        title: {
            type: 'string'
        },
        isSecret: {
            type: 'boolean'
        }
    }
};