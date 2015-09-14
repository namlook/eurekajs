
import joi from 'joi';
import _ from 'lodash';

let jsonApiSchema = {
    data: joi.object().keys({
        id: joi.string(),
        type: joi.string().required(),
        attributes: joi.object(),
        relationships: joi.object()
    })
};

export default class JsonApiBuilder {

    build(database, apiBaseUri, instance, options) {
        this.database = database;
        this.apiBaseUri = apiBaseUri;
        this.instance = instance;
        this.options = options || {};
        this._docsToInclude = [];

        return new Promise((resolve, reject) => {

            if (!this.database) {
                return reject(new Error('JsonApiBuilder: database is required'));
            }

            if (!this.database._archimedesDatabase) {
                return reject(new Error('JsonApiBuilder: database should be an archimedes database'));
            }

            if (!this.apiBaseUri) {
                return reject(new Error('JsonApiBuilder: apiBaseUri is required'));
            }

            if (joi.string().uri().validate(this.apiBaseUri).error) {
                return reject(new Error('JsonApiBuilder: apiBaseUri should be a valid uri'));
            }

            if (!this.instance) {
                return reject(new Error('JsonApiBuilder: an archimedes model instance is required'));
            }

            let results = {
                data: this.data
            };

            if (this.options.include) {
                this.loadIncluded().then((included) => {
                    results.included = included;
                    return resolve(results);
                });
            } else {
                return resolve(results);
            }

        });
    }

    validate(payload) {
        return joi.validate(payload, jsonApiSchema);
    }

    _buildData(instance) {

        if (!instance._archimedesModelInstance) {
            throw Error('JsonApiBuilder need an archimedes model instance');
        }

        let instanceId = instance._id;
        let instanceType = instance._type;
        let kebabInstanceType = _.kebabCase(instanceType);
        let include = this.options.include;

        let results = {
            id: instanceId,
            type: instanceType,
            links: {
                self: `${this.apiBaseUri}/${kebabInstanceType}/${instanceId}`
            }
        };

        let attributes = {};
        let relationships = {};
        let included = [];

        instance.Model.schema.properties.forEach((property) => {
            let value = instance.get(property.name);

            if (property.isRelation()) {

                if (property.isArray()) {
                    if (value && !_.isEmpty(value)) {
                        value = value.map((o) => {
                            let rel = {id: o._id, type: o._type};

                            if (typeof include === 'string') {
                                if (include === property.name) {
                                    included.push(rel);
                                }
                            } else if (include) {
                                included.push(rel);
                            }

                            return rel;
                        });
                    } else {
                        value = null;
                    }
                } else {
                    if (value) {
                        value = {id: value._id, type: value._type};

                        if (typeof include === 'string') {
                            if (include === property.name) {
                                included.push(value);
                            }
                        } else if (include) {
                            included.push(value);
                        }
                    }
                }

                if (value != null) {
                    relationships[property.name] = {
                        data: value,
                        links: {
                            self: `${this.apiBaseUri}/${kebabInstanceType}/${instanceId}/relationships/${property.name}`,
                            related: `${this.apiBaseUri}/${kebabInstanceType}/${instanceId}/${property.name}`
                        }
                    };
                }

            } else {
                if (value != null) {
                    attributes[property.name] = value;
                }
            }

        });

        if (!_.isEmpty(attributes)) {
            results.attributes = attributes;
        }

        if (!_.isEmpty(relationships)) {
            results.relationships = relationships;
        }


        if (included.length) {
            included = _.uniq(included, (o) => `${o.type}/${o.id}`);
            this._docsToInclude = this._docsToInclude.concat(included);
        }

        return results;
    }


    get data() {
        if (!this.instance) {
            return null;
        }

        if (_.isArray(this.instance)) {
            return this.instance.map((o) => this._buildData(o));
        } else {
            return this._buildData(this.instance);
        }
    }

    loadIncluded() {
        return new Promise((resolve, reject) => {
            if (!this.options.include) {
                return resolve([]);
            }

            this._docsToInclude = _.uniq(this._docsToInclude, (o) => `${o.type}/${o.id}`);

            let includedPromises = this._docsToInclude.map((doc) => {
                return this.database[doc.type].fetch(doc.id);
            });

            Promise.all(includedPromises).then((docs) => {
                let results = docs.map((o) => this._buildData(o));
                return resolve(results);
            }).catch((error) => {
                reject(error);
            });
        });
    }
}