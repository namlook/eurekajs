
import _ from 'lodash';
import joi from 'joi';

import es from 'event-stream';
import {Readable} from 'stream';
import streamStream from 'stream-stream';

import {resourceObjectLink/*, streamJsonApi, streamCsv*/} from '../utils';

let jsonApiRelationshipsSchema = joi.object().keys({
    id: joi.string().required(),
    type: joi.string().required()
});

let jsonApiLinkSchema = joi.object().keys({
    self: joi.string(),
    related: joi.string()
});

let jsonApiSchema = joi.object().keys({
    data: joi.object().keys({
        id: joi.string(),
        type: joi.string().required(),
        attributes: joi.object(),
        relationships: joi.object().pattern(/.+/, joi.object().keys({
            data: joi.alternatives().try(
                jsonApiRelationshipsSchema,
                joi.array().items(jsonApiRelationshipsSchema)
            ),
            links: jsonApiLinkSchema
        }))
    }).required(),
    links: jsonApiLinkSchema
});

import Promise from 'bluebird';

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
            //         token: joi.number(),
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
            let includeProperties = request.query.include;
            if (includeProperties) {
                if (_.isString(includeProperties)) {
                    includeProperties = includeProperties.split(',');
                }
                include = {properties: includeProperties, included: []};
            }

            let results = {
                links: {
                    self: `${apiBaseUri}/${Model.meta.names.plural}`
                }
            };

            Model.find(queryFilter, queryOptions).then((collection) => {
                let jsonApiData = collection.map((instance) => {
                    let resourceLink = resourceObjectLink(apiBaseUri, instance);
                    let res = instance.toJsonApi(resourceLink, include);
                    return res.data;
                });

                results.data = jsonApiData;

                /**
                 * fetch included if needed
                 */
                let included = include && include.included || [];

                const CONCURRENCY_LIMIT = 10;
                return Promise.map(included, (doc) => {
                    return db[doc.type].fetch(doc.id);
                }, {concurrency: CONCURRENCY_LIMIT});

            }).then((docs) => {
                if (docs.length) {
                    results.included = _.compact(docs).map((o) => {
                        return o.toJsonApi(resourceObjectLink(apiBaseUri, o)).data;
                    });
                }
                return reply.jsonApi(results);
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

            reply.jsonApi(results);
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
                    let relationType = db[property.type].meta.names.plural;
                    let url = `${apiBaseUri}/${relationType}`;

                    if (property.isArray()) {
                        let filter;
                        let inverseRelationships = property.getInverseRelationshipsFromProperty();

                        inverseRelationships = inverseRelationships.filter((o) => {
                            return o.config.abstract.fromReverse.property === property.name;
                        });

                        if (inverseRelationships.length) {
                            filter = `filter[${inverseRelationships[0].name}._id]`;
                        } else {
                            property = property.getPropertyFromInverseRelationship();
                            filter = `filter[${property.name}._id]`;
                        }

                        url += `?${encodeURIComponent(filter)}=${encodeURIComponent(instance._id)}`;

                    } else {

                        let relationId = instance.get(propertyName)._id;
                        url += `/${encodeURIComponent(relationId)}`;
                    }

                    return reply.redirect(url);
                }
                return reply.notFound();
            }

            let include;
            let includeProperties = request.query.include;
            if (includeProperties) {
                if (_.isString(includeProperties)) {
                    includeProperties = includeProperties.split(',');
                }
                include = {properties: includeProperties, included: []};
            }

            let resourceLink = resourceObjectLink(apiBaseUri, instance);
            let results = instance.toJsonApi(resourceLink, include);

            /**
             * fetch included if needed
             */
            let included = include && include.included || [];

            const CONCURRENCY_LIMIT = 50;

            Promise.map(included, (doc) => {
                return db[doc.type].fetch(doc.id);
            }, {concurrency: CONCURRENCY_LIMIT}).then((docs) => {
                if (docs.length) {
                    results.included = docs.map((o) => {
                        return o.toJsonApi(resourceObjectLink(apiBaseUri, o)).data;
                    });
                }

                return reply.jsonApi(results);
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
                return reply.jsonApi({data: total});
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
                _type: Model.name
            };

            if (jsonApiData.id) {
                doc._id = jsonApiData.id;
            }

            if (jsonApiData.attributes) {
                doc = _.assign(doc, jsonApiData.attributes);
            }

            if (jsonApiData.relationships) {
                _.forOwn(jsonApiData.relationships, (relationData, relationName) => {
                    if (_.isArray(relationData.data)) {
                        relationData = relationData.data.map((o) => {
                            return {
                                _id: o.id,
                                _type: o.type
                            };
                        });
                    } else {
                        relationData = {
                            _id: relationData.data.id,
                            _type: relationData.data.type
                        };
                    }
                    doc[relationName] = relationData;
                });
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
                return reply.created(results).type('application/vnd.api+json');
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
                            return {
                                _id: item.id,
                                _type: item.type
                            };
                        });
                    } else {
                        value = {
                            _id: value.data.id,
                            _type: value.data.type
                        };
                    }
                    instance.set(propertyName, value);
                });
            }

            instance.save().then((savedDoc) => {
                let resourceLink = resourceObjectLink(apiBaseUri, savedDoc);
                let results = savedDoc.toJsonApi(resourceLink);
                return reply.jsonApi(results);
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
                return reply.jsonApi({data: data});
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
            let {Model, /*apiBaseUri,*/ db} = request;
            let {delimiter} = request.query;
            let {format} = request.params;

            let contentType;
            if (format === 'tsv') {
                format = 'csv';
                delimiter = '\t';
                contentType = 'text/tab-separated-values';
            }

            let stream;
            try {
                stream = db.stream(Model.name, queryFilter, queryOptions);
            } catch(err) {
                if (err.name === 'ValidationError') {
                    return reply.badRequest(err);
                }
                return reply.badImplementation(err);
            }

            let resultStream;

            if (format === 'json') {
                // contentType = 'application/vnd.api+json';
                contentType = 'application/json';

                let beginStream = new Readable();
                beginStream.push('{"data":[');
                beginStream.push(null);

                // TODO
                let jsonApiTransform = es.map((doc, callback) => {
                    try {
                        doc = JSON.stringify(doc);
                        callback(null, doc);
                    } catch(err) {
                        callback(err);
                    }
                });

                let contentStream = stream.pipe(jsonApiTransform).pipe(es.join(','));

                let endStream = new Readable();
                endStream.push(']}');
                endStream.push(null);

                resultStream = streamStream();
                resultStream.write(beginStream);
                resultStream.write(contentStream);
                resultStream.write(endStream);
                resultStream.end();
            }
            else if (format === 'csv') {
                if (!contentType) {
                    contentType = 'text/csv';
                }

                let csvOptions = {fields: queryOptions.fields, delimiter: delimiter};

                let csvHeader;
                try {
                    csvHeader = Model.csvHeader(csvOptions);
                } catch(err) {
                    return reply.badImplementation(err);
                }

                csvHeader = `${csvHeader}\n`;

                let beginStream = new Readable();
                beginStream.push(csvHeader);
                beginStream.push(null);

                let csvTransform = es.map((doc, callback) => {
                    Model.wrap(doc).toCsv(csvOptions).then((csvLine) => {
                        callback(null, csvLine);
                    }).catch((err) => {
                        callback(err);
                    });
                });

                let contentStream = stream.pipe(csvTransform).pipe(es.join('\n'));

                resultStream = streamStream();
                resultStream.write(beginStream);
                resultStream.write(contentStream);
                resultStream.end();
            }

            return reply.ok(resultStream)
                        .type(contentType)
                        .header(
                            'Content-Disposition',
                            `attachment; filename="${Model.name}.${format}"`
                        );
        }
    }
};

export default function() {
    return routes;
}
