
import _ from 'lodash';
import joi from 'joi';
// import JsonApi from './plugins/eureka/json-api-builder';
import {resourceObjectLink, streamJsonApi, streamCsv} from './utils';

let jsonApiSchema = {
    data: joi.object().keys({
        id: joi.string(),
        type: joi.string().required(),
        attributes: joi.object(),
        relationships: joi.object()
    }).required()
};

/**
 * to disable eureka's magic on a route,
 * just set `config.plugins.eureka = false`
 */

var routes = {

    find: {
        method: 'GET',
        path: '/',
        config: {
            validate: {
                query: {
                    token: joi.number(),
                    include: joi.alternatives().try(
                        joi.number(),
                        joi.string()
                    ).default(false)
                }
            }
        },
        handler: function(request, reply) {
            let {queryFilter, queryOptions} = request.pre;
            let {db, apiBaseUri, Model} = request;

            let include;
            if (request.query.include) {
                include = {properties: request.query.include, included: []};
            }

            let kebabModelName = _.kebabCase(request.Model.name);
            let results = {
                links: {
                    self: `${apiBaseUri}/${kebabModelName}`
                }
            };

            Model.find(queryFilter, queryOptions).then((collection) => {
                let jsonApiData = collection.map((instance) => {
                    let resourceLink = resourceObjectLink(apiBaseUri, instance);
                    let res = instance.toJsonApi(resourceLink, include);
                    return res.data;
                });

                results.data = jsonApiData;//.map((o) => o.data);

                /**
                 * fetch included if needed
                 */
                let includedPromises = [];
                if (include && include.included.length) {
                    includedPromises = include.included.map((doc) => {
                        return db[doc.type].fetch(doc.id);
                    });
                }

                return Promise.all(includedPromises);
            }).then((docs) => {
                if (docs.length) {
                    results.included = docs.map((o) => {
                        return o.toJsonApi(resourceObjectLink(apiBaseUri, o)).data;
                    });
                }

                return reply.ok(results);
            }).catch((error) => {
                if (error.name === 'ValidationError') {
                    return reply.badRequest(error, error.extra);
                }
                return reply.badImplementation(error);
            });
        }
    },

    fetchRelationships: {
        method: 'GET',
        path: '/{id}/relationships/{propertyName}',
        handler: function(request, reply) {
            let instance = request.pre.document;
            let propertyName = request.params.propertyName;
            let apiBaseUri = request.apiBaseUri;


            let resourceLink = resourceObjectLink(apiBaseUri, instance);
            let jsonApiData = instance.toJsonApi(resourceLink);

            let results;

            if (jsonApiData.data.relationships) {
                results = jsonApiData.data.relationships[propertyName];
            }

            if (!results) {
                return reply.notFound();
            }

            reply.ok(results);
        }
    },


    fetch: {
        method: 'GET',
        path: '/{id}/{relation?}',
        config: {
            validate: {
                query: {
                    include: joi.alternatives().try(
                        joi.number(),
                        joi.string()
                    ).default(false)
                }
            }
        },
        handler: function(request, reply) {
            let instance = request.pre.document;
            let propertyName = request.params.relation;
            let {db, apiBaseUri} = request;

            /** if a relation is specified in url,
             * then redirect and fetch this relation instead
             */
            if (propertyName) {
                let property = instance.Model.schema.getProperty(propertyName);
                if (property) {
                    let reversedProperty = property.reversedProperty();
                    if (reversedProperty) {
                        let kebabRelationType = _.kebabCase(property.type);
                        let url = `${apiBaseUri}/${kebabRelationType}`;//
                        if (property.isArray()) {
                            let filter = encodeURIComponent(`filter[${reversedProperty.name}._id]`);
                            url += `?${filter}=${instance._id}`;
                        } else {
                            let relationId = instance.get(propertyName)._id;
                            url += `/${relationId}`;
                        }
                        return reply.redirect(url);
                    }
                }
                return reply.notFound();
            }

            let include;
            if (request.query.include) {
                include = {properties: request.query.include, included: []};
            }


            let results = instance.toJsonApi(resourceObjectLink(apiBaseUri, instance), include);

            /**
             * fetch included if needed
             */

            let includedPromises = [];
            if (include && include.included.length) {
                includedPromises = include.included.map((doc) => {
                    return db[doc.type].fetch(doc.id);
                });
            }

            Promise.all(includedPromises).then((docs) => {
                if (docs.length) {
                    results.included = docs.map((o) => {
                        return o.toJsonApi(resourceObjectLink(apiBaseUri, o)).data;
                    });
                }

                return reply.ok(results);
            }).catch((error) => {
                return reply.badImplementation(error);
            });
        }
    },


    count: {
        method: 'GET',
        path: `/i/count`,
        handler: function(request, reply) {
            let {queryFilter, queryOptions} = request.pre;
            request.Model.count(queryFilter, queryOptions).then((total) => {
                return reply.ok({data: total});
            }).catch((err) => {
                if (err.name === 'ValidationError') {
                    return reply.badRequest(err, err.extra);
                }
                return reply.badImplementation(err);
            });
        }
    },


    create: {
        method: 'POST',
        path: '/',
        handler: function(request, reply) {
            let {payload, Model, apiBaseUri} = request;

            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (parseError) {
                    return reply.badRequest('The payload should be a valid JSON', {payload: payload, parseError: parseError});
                }
            }

            /** validate the jsonapi payload
             */
            // let builder = new JsonApiBuilder();
            let {error: validationError} = joi.validate(payload, jsonApiSchema);
            if (validationError) {
                return reply.badRequest('ValidationError', validationError);
            }

            /** build archimedes pojo from jsonapi data
             */
            let jsonApiData = payload.data;

            let doc = {
                _type: jsonApiData.type
            };

            if (jsonApiData.id) {
                doc._id = jsonApiData.id;
            }

            if (jsonApiData.attributes) {
                doc = _.assign(doc, jsonApiData.attributes);
            }

            if (jsonApiData.relationships) {
                doc = _.assign(doc, jsonApiData.relationships);
            }

            /** build a promise that will check the instance existance
             * if needed
             */
            let checkExistancePromise = new Promise((resolve) => {
                if (doc._id) {
                    Model.fetch(doc._id).then((docExists) => {
                        if (docExists) {
                            return reply.conflict(`${doc._id} already exists`);
                        }
                        return resolve();
                    });
                } else {
                    return resolve();
                }
            });

            /** fire the engine !
             */
            checkExistancePromise.then(() => {
                return Model.create(doc).save();
            }).then((data) => {
                let resourceLink = resourceObjectLink(apiBaseUri, data);
                let results = data.toJsonApi(resourceLink);
                return reply.created(results);
            }).catch((err) => {
                if (err.name === 'ValidationError') {
                    return reply.badRequest(
                        `${err.name}: ${err.extra}`, {failedDocument: payload});
                } else {
                    return reply.badImplementation(err);
                }
            });
        }
    },


    update: {
        method: ['PATCH'],
        path: `/{id}`,
        handler: function(request, reply) {
            let {payload, apiBaseUri} = request;

            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (parseError) {
                    return reply.badRequest('The payload should be a valid JSON', {payload: payload, parseError: parseError});
                }
            }

            // let jsonApi = new JsonApiBuilder();
            let {error: validationError} = joi.validate(payload, jsonApiSchema);
            if (validationError) {
                return reply.badRequest('malformed payload', validationError);
            }

            let jsonApiData = payload.data;
            let instance = request.pre.document;

            if (jsonApiData.attributes) {
                _.forEach(jsonApiData.attributes, (value, propertyName) => {
                    instance.set(propertyName, value);
                });
            }

            if (jsonApiData.relationships) {
                _.forEach(jsonApiData.relationships, (value, propertyName) => {
                    if (_.isArray(value.data)) {
                        value = value.data.map((item) => {
                            return {_id: item.id, _type: item.type};
                        });
                    } else {
                        value = {_id: value.data.id, _type: value.data.type};
                    }
                    instance.set(propertyName, value);
                });
            }

            instance.save().then((savedDoc) => {
                let resourceLink = resourceObjectLink(apiBaseUri, savedDoc);
                let results = savedDoc.toJsonApi(resourceLink);
                return reply.ok(results);
            }).catch((error) => {
                if (error.name === 'ValidationError') {
                    return reply.badRequest(
                        `${error.name}: ${error.extra}`, {failedDocument: payload});
                } else {
                    return reply.badImplementation(error);
                }
            });
        }
    },


    updateRelationships: {
        method: 'PATCH',
        path: '/{id}/relationships/{propertyName}',
        handler: function(request, reply) {
            let instance = request.pre.document;
            let propertyName = request.params.propertyName;

            let {payload} = request;

            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (parseError) {
                    return reply.badRequest('The payload should be a valid JSON', {payload: payload, parseError: parseError});
                }
            }

            let value;
            if (_.isArray(payload.data)) {
                value = payload.data.map((item) => {
                    return {_id: item.id, _type: item.type};
                });
            } else {
                value = {_id: payload.data.id, _type: payload.data.type};
            }
            instance.set(propertyName, value);

            instance.save().then(() => {
                return reply.noContent();
            }).catch((error) => {
                if (error.name === 'ValidationError') {
                    return reply.badRequest(
                        `${error.name}: ${error.extra}`);
                } else {
                    return reply.badImplementation(error);
                }
            });
        }
    },


    delete: {
        method: 'DELETE',
        path: `/{id}`,
        handler: function(request, reply) {
            request.pre.document.delete().then(() => {
                return reply.noContent();
            }).catch((err) => {
                return reply.badImplementation(err);
            });
        }
    },

    deleteRelationships: {
        method: 'DELETE',
        path: '/{id}/relationships/{propertyName}',
        handler: function(request, reply) {
            let instance = request.pre.document;
            let propertyName = request.params.propertyName;

            let property = instance.Model.schema.getProperty(propertyName);

            if (!property) {
                return reply.notFound();
            }

            instance.unset(propertyName);

            instance.save().then(() => {
                return reply.noContent();
            }).catch((error) => {
                return reply.badImplementation(error);
            });
        }
    },


    groupBy: {
        method: 'GET',
        path: '/i/group-by/{property}',
        handler: function(request, reply) {
            let {Model} = request;

            let property = request.params.property;

            let {queryFilter} = request.pre;

            Model.groupBy(property, queryFilter).then((data) => {
                return reply.ok({data: data});
            }).catch((err) => {
                if (err.name === 'ValidationError') {
                    return reply.badRequest(err.message, err.extra);
                }
                return reply.badImplementation(err);
            });
        }
    },


    stream: {
        method: 'GET',
        path: '/i/stream/{format}',
        config: {
            validate: {
                params: {
                    format: joi.string().only('json', 'csv', 'tsv').label('format')
                },
                query: {
                    // asJsonArray: joi.boolean()
                    delimiter: joi.string().default(',')
                }
            }
        },
        handler: function(request, reply) {
            let {queryFilter, queryOptions} = request.pre;
            let {Model, apiBaseUri} = request;
            let {delimiter} = request.query;

            Model.count(queryFilter).then((total) => {
                let {format} = request.params;

                let contentStream;
                if (format === 'json') {
                    contentStream = streamJsonApi(Model, total, queryFilter, queryOptions, apiBaseUri);
                } else if (format === 'csv') {
                    contentStream = streamCsv(Model, total, queryFilter, queryOptions, delimiter);
                } else if (format === 'tsv') {
                    contentStream = streamCsv(Model, total, queryFilter, queryOptions, '\t');
                }

                return reply.ok(contentStream);

            });
        }
    }
};

routes.all = _.values(routes);
export default routes;
