module.exports = {
    properties: {
        text: {
            type: 'string'
        },
        integer: {
            type: 'integer'
        },
        float: {
            type: 'float'
        },
        boolean: {
            type: 'boolean'
        },
        date: {
            type: 'date'
        },
        datetime: {
            type: 'datetime'
        },
        array: {
            type: 'string',
            multi: {
                validations: [{length: 3}]
            }
        },
        attachement: {
            type: 'string',
            propagateDeletion: true
        },
        relation: {
            type: 'GenericRelation',
            propagateDeletion: true
        },
        relations: {
            type: 'GenericRelation',
            multi: true
        }
    }
};