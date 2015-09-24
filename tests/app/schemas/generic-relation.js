
module.exports = {
    properties: {
        text: {
            type: 'string'
        },
        related: {
            type: 'boolean'
        }
    },
    inverseRelationships: {
        genericsRelation: {
            type: 'Generic',
            property: 'relation'
        },
        genericsRelations: {
            type: 'Generic',
            property: 'relations'
        }
    }
};