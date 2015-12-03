
import _ from 'lodash';
import joi from 'joi';

import es from 'event-stream';
import {Readable} from 'stream';
import streamStream from 'stream-stream';

import {doc2jsonApi, streamJsonApi, streamCSV} from '../utils';

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
                joi.array().items(jsonApiRelationshipsSchema),
                joi.string().empty(),
                null
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
                    include: joi.alternatives().try(
                        joi.number(),
                        joi.string()
                    ).default(false),
                    filter: joi.object().pattern(/.+/,
                        joi.alternatives().try(
                            joi.string(),
                            joi.object()
                        )
                    ),
                    limit: joi.number().default(20),
                    offset: joi.number().min(0),
                    distinct: joi.boolean().default(false),
                    sort: joi.alternatives().try(
                        joi.array().items(joi.string()),
                        joi.string()
                    ),
                    fields: joi.alternatives().try(
                        joi.array().items(joi.string()),
                        joi.string()
                    )
                }
            }
        },
        handler: function(request, reply) {
            let {filter: queryFilter, limit, offset, distinct, sort, fields} = request.query;
            let queryOptions = {
                limit,
                offset,
                distinct,
                sort,
                fields
            };

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

            db.find(Model.name, queryFilter, queryOptions).then((collection) => {
                let jsonApiData = collection.map((doc) => {
                    return doc2jsonApi(Model, doc, apiBaseUri, include);
                });

                results.data = jsonApiData;

                /**
                 * fetch included if needed
                 */
                let included = include && include.included || [];

                const CONCURRENCY_LIMIT = 10;
                return Promise.map(included, (ref) => {
                    let [type, id] = ref.split(':::');
                    return db.fetch(type, id);
                }, {concurrency: CONCURRENCY_LIMIT});

            }).then((docs) => {
                if (docs.length) {
                    results.included = _.compact(docs).map((o) => {
                        return doc2jsonApi(db[o._type], o, apiBaseUri);
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


            let jsonApiData = doc2jsonApi(instance.Model, instance.attrs(), apiBaseUri);

            let results;

            if (jsonApiData.relationships) {
                results = jsonApiData.relationships[propertyName];
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
                    ).default(false),
                    fields: joi.alternatives().try(
                        joi.array().items(joi.string()),
                        joi.string()
                    )
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

            let pojo = instance.attrs();

            let {fields} = request.query;
            fields = fields || [];
            if (typeof fields === 'string') {
                fields = fields.split(',');
            }

            if (fields.length) {
                pojo = _.pick(pojo, fields);
            }


            let include;
            let includeProperties = request.query.include;
            if (includeProperties) {
                if (_.isString(includeProperties)) {
                    includeProperties = includeProperties.split(',');
                }
                include = {properties: includeProperties, included: []};
            }

            let included = include && include.included || [];


            let results = {
                data: doc2jsonApi(instance.Model, pojo, apiBaseUri, include),
                links: {
                    self: `${apiBaseUri}/${instance.Model.meta.names.plural}/${instance._id}`
                }
            };

            /**
             * fetch included if needed
             */
            const CONCURRENCY_LIMIT = 50;

            Promise.map(included, (ref) => {
                let [type, id] = ref.split(':::');
                return db.fetch(type, id);
            }, {concurrency: CONCURRENCY_LIMIT}).then((docs) => {
                if (docs.length) {
                    results.included = docs.map((o) => {
                        return doc2jsonApi(db[o._type], o, apiBaseUri);
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
        config: {
            validate: {
                query: {
                    filter: joi.object().pattern(/.+/,
                        joi.alternatives().try(
                            joi.string(),
                            joi.object()
                        )
                    ),
                    distinct: joi.boolean().default(false)
                }
            }
        },
        handler: function(request, reply) {
            let {filter: queryFilter, distinct} = request.query;
            let queryOptions = {
                distinct
            };

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
            let {payload, Model, apiBaseUri, db} = request;

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
                    db.fetch(Model.name, doc._id).then((docExists) => {
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
            }).then((savedData) => {
                let results = {
                    data: doc2jsonApi(Model, savedData.attrs(), apiBaseUri),
                    links: {
                        self: `${apiBaseUri}/${Model.meta.names.plural}/${savedData._id}`
                    }
                };
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
            let {payload, apiBaseUri, db} = request;

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
                    if (value == null && value === '') {
                        instance.unset(propertyName);
                    } else {
                        instance.set(propertyName, value);
                    }
                });
            }

            if (jsonApiData.relationships) {
                for (let propertyName of Object.keys(jsonApiData.relationships)) {
                    let value = jsonApiData.relationships[propertyName];

                    if( !value.data) {
                        instance.unset(propertyName);
                    }
                    else {
                        if (_.isArray(value.data)) {
                            let _values = [];
                            for (let item of value.data) {
                                if (!db[item.type]) {
                                   return reply.badRequest(`bad payload: unknown type "${item.type}" for the relation "${propertyName}"`);
                                }

                                _values.push({
                                    _id: item.id,
                                    _type: item.type
                                });
                            }
                            value = _values;
                        } else {
                            if (!db[value.data.type]) {
                               return reply.badRequest(`bad payload: unknown type "${value.data.type}" for the relation "${propertyName}"`);
                            }

                            value = {
                                _id: value.data.id,
                                _type: value.data.type
                            };
                        }
                        instance.set(propertyName, value);
                    }
                }
            }

            instance.save().then((savedDoc) => {
                let results = {
                    data: doc2jsonApi(instance.Model, savedDoc.attrs(), apiBaseUri)
                };
                return reply.jsonApi(results);
            }).catch((error) => {
                if (error.name === 'ValidationError') {
                    let errorMessage = error.name;
                    if (error.extra) {
                        errorMessage = `${error.name}: ${error.extra}`;
                    }
                    return reply.badRequest(
                        errorMessage, {failedDocument: payload});
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

            let {payload, db} = request;

            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (parseError) {
                    return reply.badRequest('The payload should be a valid JSON', {payload: payload, parseError: parseError});
                }
            }

            if (payload.data == null) {
                instance.unset(propertyName);
            } else {
                let value;
                if (_.isArray(payload.data)) {
                    value = [];
                    for (let item of payload.data) {
                        if (!db[item.type]) {
                           return reply.badRequest(`bad payload: unknown type "${item.type}" for the relation "${propertyName}"`);
                        }
                        value.push({_id: item.id, _type: item.type});
                    }
                } else {
                    if (!db[payload.data.type]) {
                       return reply.badRequest(`bad payload: unknown type "${payload.data.type}" for the relation "${propertyName}"`);
                    }
                    value = {_id: payload.data.id, _type: payload.data.type};
                }
                instance.set(propertyName, value);
            }

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
        config: {
            validate: {
                query: {
                    operator: joi.string().default('count'),
                    target: joi.string(),
                    filter: joi.object().pattern(/.+/,
                        joi.alternatives().try(
                            joi.string(),
                            joi.object()
                        )
                    )
                }
            }
        },
        handler: function(request, reply) {
            let {Model} = request;

            let property = request.params.property.split(',');

            let {filter: queryFilter} = request.query;
            let queryOptions = {};


            let {operator, target} = request.query;

            let aggregator = {
                property: property
            };

            if (operator) {
                aggregator.aggregation = aggregator.aggregation || {};
                aggregator.aggregation.operator = operator;
            }

            if (target) {
                aggregator.aggregation = aggregator.aggregation || {};
                aggregator.aggregation.target = target;
            }

            Model.groupBy(aggregator, queryFilter, queryOptions).then((data) => {
                return reply.jsonApi({data: data});
            }).catch((err) => {
                if (err.name === 'ValidationError') {
                    return reply.badRequest(err.message, err.extra);
                }
                return reply.badImplementation(err);
            });
        }
    },

    aggregate: {
        method: 'GET',
        path: '/i/aggregate',
        config: {
            validate: {
                query: {
                    field: joi.object().pattern(/.+/,
                        joi.alternatives().try(
                            joi.string(),
                            joi.object().pattern(/^\$.+/,
                                joi.alternatives().try(
                                    joi.boolean(),
                                    joi.string()
                                )
                            )
                        )
                    ),
                    // TODO remove
                    label: joi.object().pattern(/.+/,
                        joi.alternatives().try(
                            joi.string(),
                            joi.object().pattern(/^\$.+/,
                                joi.alternatives().try(
                                    joi.boolean(),
                                    joi.string()
                                )
                            )
                        )
                    ),
                    filter: joi.object().pattern(/.+/,
                        joi.alternatives().try(
                            joi.string(),
                            joi.object()
                        )
                    ),
                    limit: joi.number().default(100),
                    distinct: joi.boolean().default(false),
                    sort: joi.alternatives().try(
                        joi.array().items(joi.string()),
                        joi.string()
                    )
                }
            }
        },
        handler: function(request, reply) {
            let {Model, db} = request;

            let {field, label, limit, distinct, sort, filter} = request.query;

            if (label) {
                field = label;
                console.warn('[DEPRECATED] the use of label in aggregate is deprecated. Please use field instead');
            }

            let queryOptions = {
                limit,
                distinct,
                sort
            };


            db.aggregate(Model.name, field, filter, queryOptions).then((data) => {
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
                    format: joi.string().only('json', 'jsonapi', 'csv', 'tsv').label('format')
                },
                query: {
                    // asJsonArray: joi.boolean()
                    delimiter: joi.when(
                        '$params.format', {
                            is: joi.valid('csv'),
                            then: joi.string().default(','),
                            otherwise: joi.forbidden()
                        }
                    ),
                    header: joi.when(
                        '$params.format', {
                            is: joi.valid('csv', 'tsv'),
                            then: joi.boolean().default(true),
                            otherwise: joi.forbidden()
                        }
                    ),
                    include: joi.when(
                        '$params.format', {
                            is: joi.valid('jsonapi'),
                            then: joi.alternatives().try(
                                joi.number(),
                                joi.string()
                            ),
                            otherwise: joi.forbidden()
                        }
                    ),
                    filter: joi.object().pattern(/.+/,
                        joi.alternatives().try(
                            joi.string(),
                            joi.object()
                        )
                    ),
                    limit: joi.number().default(20),
                    distinct: joi.boolean().default(false),
                    sort: joi.alternatives().try(
                        joi.array().items(joi.string()),
                        joi.string()
                    ),
                    fields: joi.alternatives().try(
                        joi.array().items(joi.string()),
                        joi.string()
                    )
                },
                failAction: function (request, reply, source, error) {
                    let message = error.data.details.map((o) => o.message);
                    error.output.payload.message = message[0];
                    return reply(error);
                }
            }
        },
        handler: function(request, reply) {

            let {filter: queryFilter, limit, distinct, sort, fields} = request.query;
            let queryOptions = {
                limit,
                distinct,
                sort,
                fields
            };


            let {Model, apiBaseUri, db} = request;
            let {delimiter, header} = request.query;
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

                let csvOptions = {
                    fields: queryOptions.fields,
                    delimiter: delimiter,
                    header: header
                };

                try {
                    resultStream = streamCSV(Model, stream, csvOptions);
                } catch(err) {
                    return reply.badImplementation(err);
                }
            } else if (format === 'jsonapi') {
                format = 'json';
                contentType = 'application/vnd.api+json';

                let jsonApiOptions = {};
                let includeProperties = request.query.include;
                if (includeProperties) {
                    if (_.isString(includeProperties)) {
                        includeProperties = includeProperties.split(',');
                    }
                    jsonApiOptions.include = {properties: includeProperties, included: []};
                    jsonApiOptions.baseUri = apiBaseUri;

                }

                try {
                    resultStream = streamJsonApi(Model, stream, jsonApiOptions);
                } catch(err) {
                    return reply.badImplementation(err);
                }

                resultStream.on('error', function(error) {
                    console.log('ERRRROR', error);
                });
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
