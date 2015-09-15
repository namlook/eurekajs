
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
        if (this.options.include) {
            this._docsToInclude = [];
        }

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

            let results = this.data;

            if (_.isArray(this.instance)) {
                results = {
                    data: results
                };
            }

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
        let resourceUri = `${this.apiBaseUri}/${kebabInstanceType}/${instanceId}`;


        return instance.toJsonApi(resourceUri, this._docsToInclude);
    }


    get data() {
        if (!this.instance) {
            return null;
        }

        if (_.isArray(this.instance)) {
            return this.instance.map((o) => this._buildData(o).data);
        } else {
            return this._buildData(this.instance);
        }
    }

    loadIncluded() {
        return new Promise((resolve, reject) => {
            if (!this.options.include) {
                return resolve([]);
            }

            let includedPromises = this._docsToInclude.map((doc) => {
                return this.database[doc.type].fetch(doc.id);
            });

            Promise.all(includedPromises).then((docs) => {
                let results = docs.map((o) => this._buildData(o).data);
                return resolve(results);
            }).catch((error) => {
                reject(error);
            });
        });
    }
}