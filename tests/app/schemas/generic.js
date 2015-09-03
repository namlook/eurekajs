module.exports = {
    properties: {
        text: {
            type: 'string'
        },
        integer: {
            type: 'number'
        },
        float: {
            type: 'number',
            validate: [{precision: 2}]
        },
        boolean: {
            type: 'boolean'
        },
        date: {
            type: 'date'
        },
        datetime: {
            type: 'date'
        },
        array: {
            type: 'array',
            items: {
                type: 'string'
                // validations: [{length: 3}]
            }
        },
        attachement: {
            type: 'string'
            // propagateDeletion: true
        },
        relation: {
            type: 'GenericRelation'
            // propagateDeletion: true
        },
        relations: {
            type: 'array',
            items: 'GenericRelation'
        }
    }
};