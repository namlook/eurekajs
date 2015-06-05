
import _ from 'lodash';

class ModelProperty {
    constructor(config, modelSchema) {
        this.config = config;
        this.modelSchema = modelSchema;
    }

    get type() {
        return this.config.type;
    }

    get isRelation() {
        return !!this.modelSchema.db[this.type];
    }

    validate() {
        // TODO
    }
}

export default class ModelSchema {
    constructor(schema, db) {
        this._schema = schema;
        this.db = db;
    }

    _loadProperties() {
        this._properties = {};
        Object.keys(this._schema.properties).forEach((propertyName) => {
            let propertyConfig = this._schema.properties[propertyName];
            this._properties[propertyName] = new ModelProperty(propertyConfig, this);
        });
    }

    getProperty(propertyName) {
        if (!this._properties) {
            this._loadProperties();
        }

        if (_.contains(propertyName, '.')) {
            let relation = this._properties[propertyName.split('.')[0]];
            let relationSchema = this.db[relation.type].schema;
            let relationPropertyName = propertyName.split('.').slice(1).join('.');
            return relationSchema.getProperty(relationPropertyName);
        }

        return this._properties[propertyName];
    }
}