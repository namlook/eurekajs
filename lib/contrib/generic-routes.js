'use strict';

var _slicedToArray = require('babel-runtime/helpers/sliced-to-array')['default'];

var _getIterator = require('babel-runtime/core-js/get-iterator')['default'];

var _Object$keys = require('babel-runtime/core-js/object/keys')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _joi = require('joi');

var _joi2 = _interopRequireDefault(_joi);

var _eventStream = require('event-stream');

var _eventStream2 = _interopRequireDefault(_eventStream);

var _stream = require('stream');

var _streamStream = require('stream-stream');

var _streamStream2 = _interopRequireDefault(_streamStream);

var _utils = require('../utils');

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

/**
 * to disable eureka's magic on a route,
 * just set `config.plugins.eureka = false`
 */

var jsonApiRelationshipsSchema = _joi2['default'].object().keys({
    id: _joi2['default'].string().required(),
    type: _joi2['default'].string().required()
});

var jsonApiLinkSchema = _joi2['default'].object().keys({
    self: _joi2['default'].string(),
    related: _joi2['default'].string()
});

var jsonApiSchema = _joi2['default'].object().keys({
    data: _joi2['default'].object().keys({
        id: _joi2['default'].string(),
        type: _joi2['default'].string().required(),
        attributes: _joi2['default'].object(),
        relationships: _joi2['default'].object().pattern(/.+/, _joi2['default'].object().keys({
            data: _joi2['default'].alternatives()['try'](jsonApiRelationshipsSchema, _joi2['default'].array().items(jsonApiRelationshipsSchema), _joi2['default'].string().empty(), null),
            links: jsonApiLinkSchema
        }))
    }).required(),
    links: jsonApiLinkSchema
});

var routes = {

    find: {
        method: 'GET',
        path: '/',
        config: {
            validate: {
                query: {
                    //         token: joi.number(),
                    include: _joi2['default'].alternatives()['try'](_joi2['default'].number(), _joi2['default'].string())['default'](false)
                }
            }
        },
        handler: function handler(request, reply) {
            var _request$pre = request.pre;
            var queryFilter = _request$pre.queryFilter;
            var queryOptions = _request$pre.queryOptions;
            var db = request.db;
            var apiBaseUri = request.apiBaseUri;
            var Model = request.Model;

            var include = undefined;
            var includeProperties = request.query.include;
            if (includeProperties) {
                if (_lodash2['default'].isString(includeProperties)) {
                    includeProperties = includeProperties.split(',');
                }
                include = { properties: includeProperties, included: [] };
            }

            var results = {
                links: {
                    self: apiBaseUri + '/' + Model.meta.names.plural
                }
            };

            db.find(Model.name, queryFilter, queryOptions).then(function (collection) {
                var jsonApiData = collection.map(function (doc) {
                    return (0, _utils.doc2jsonApi)(Model, doc, apiBaseUri, include);
                });

                results.data = jsonApiData;

                /**
                 * fetch included if needed
                 */
                var included = include && include.included || [];

                var CONCURRENCY_LIMIT = 10;
                return _bluebird2['default'].map(included, function (ref) {
                    var _ref$split = ref.split(':::');

                    var _ref$split2 = _slicedToArray(_ref$split, 2);

                    var type = _ref$split2[0];
                    var id = _ref$split2[1];

                    return db.fetch(type, id);
                }, { concurrency: CONCURRENCY_LIMIT });
            }).then(function (docs) {
                if (docs.length) {
                    results.included = _lodash2['default'].compact(docs).map(function (o) {
                        return (0, _utils.doc2jsonApi)(db[o._type], o, apiBaseUri);
                    });
                }
                return reply.jsonApi(results);
            })['catch'](function (error) {
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
        handler: function handler(request, reply) {
            var instance = request.pre.document;
            var propertyName = request.params.propertyName;
            var apiBaseUri = request.apiBaseUri;

            var jsonApiData = (0, _utils.doc2jsonApi)(instance.Model, instance.attrs(), apiBaseUri);

            var results = undefined;

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
                    include: _joi2['default'].alternatives()['try'](_joi2['default'].number(), _joi2['default'].string())['default'](false)
                }
            }
        },
        handler: function handler(request, reply) {
            var instance = request.pre.document;
            var propertyName = request.params.relation;
            var db = request.db;
            var apiBaseUri = request.apiBaseUri;

            /** if a relation is specified in url,
             * then redirect and fetch this relation instead
             */
            if (propertyName) {
                var _ret = (function () {
                    var property = instance.Model.schema.getProperty(propertyName);
                    if (property) {
                        var relationType = db[property.type].meta.names.plural;
                        var url = apiBaseUri + '/' + relationType;

                        if (property.isArray()) {
                            var filter = undefined;
                            var inverseRelationships = property.getInverseRelationshipsFromProperty();

                            inverseRelationships = inverseRelationships.filter(function (o) {
                                return o.config.abstract.fromReverse.property === property.name;
                            });

                            if (inverseRelationships.length) {
                                filter = 'filter[' + inverseRelationships[0].name + '._id]';
                            } else {
                                property = property.getPropertyFromInverseRelationship();
                                filter = 'filter[' + property.name + '._id]';
                            }

                            url += '?' + encodeURIComponent(filter) + '=' + encodeURIComponent(instance._id);
                        } else {

                            var relationId = instance.get(propertyName)._id;
                            url += '/' + encodeURIComponent(relationId);
                        }

                        return {
                            v: reply.redirect(url)
                        };
                    }
                    return {
                        v: reply.notFound()
                    };
                })();

                if (typeof _ret === 'object') return _ret.v;
            }

            var pojo = instance.attrs();

            var fields = request.pre.queryOptions.fields;

            if (fields) {
                pojo = _lodash2['default'].pick(pojo, fields);
            }

            var include = undefined;
            var includeProperties = request.query.include;
            if (includeProperties) {
                if (_lodash2['default'].isString(includeProperties)) {
                    includeProperties = includeProperties.split(',');
                }
                include = { properties: includeProperties, included: [] };
            }

            var included = include && include.included || [];

            var results = {
                data: (0, _utils.doc2jsonApi)(instance.Model, pojo, apiBaseUri, include),
                links: {
                    self: apiBaseUri + '/' + instance.Model.meta.names.plural + '/' + instance._id
                }
            };

            /**
             * fetch included if needed
             */
            var CONCURRENCY_LIMIT = 50;

            _bluebird2['default'].map(included, function (ref) {
                var _ref$split3 = ref.split(':::');

                var _ref$split32 = _slicedToArray(_ref$split3, 2);

                var type = _ref$split32[0];
                var id = _ref$split32[1];

                return db.fetch(type, id);
            }, { concurrency: CONCURRENCY_LIMIT }).then(function (docs) {
                if (docs.length) {
                    results.included = docs.map(function (o) {
                        return (0, _utils.doc2jsonApi)(db[o._type], o, apiBaseUri);
                    });
                }

                return reply.jsonApi(results);
            })['catch'](function (error) {
                return reply.badImplementation(error);
            });
        }
    },

    count: {
        method: 'GET',
        path: '/i/count',
        handler: function handler(request, reply) {
            var _request$pre2 = request.pre;
            var queryFilter = _request$pre2.queryFilter;
            var queryOptions = _request$pre2.queryOptions;

            request.Model.count(queryFilter, queryOptions).then(function (total) {
                return reply.jsonApi({ data: total });
            })['catch'](function (err) {
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
        handler: function handler(request, reply) {
            var payload = request.payload;
            var Model = request.Model;
            var apiBaseUri = request.apiBaseUri;
            var db = request.db;

            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (parseError) {
                    return reply.badRequest('The payload should be a valid JSON', { payload: payload, parseError: parseError });
                }
            }

            /** validate the jsonapi payload
             */
            // let builder = new JsonApiBuilder();

            var _joi$validate = _joi2['default'].validate(payload, jsonApiSchema);

            var validationError = _joi$validate.error;

            if (validationError) {
                return reply.badRequest('ValidationError', validationError);
            }

            /** build archimedes pojo from jsonapi data
             */
            var jsonApiData = payload.data;

            var doc = {
                _type: Model.name
            };

            if (jsonApiData.id) {
                doc._id = jsonApiData.id;
            }

            if (jsonApiData.attributes) {
                doc = _lodash2['default'].assign(doc, jsonApiData.attributes);
            }

            if (jsonApiData.relationships) {
                _lodash2['default'].forOwn(jsonApiData.relationships, function (relationData, relationName) {
                    if (_lodash2['default'].isArray(relationData.data)) {
                        relationData = relationData.data.map(function (o) {
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
            var checkExistancePromise = new _bluebird2['default'](function (resolve) {
                if (doc._id) {
                    db.fetch(Model.name, doc._id).then(function (docExists) {
                        if (docExists) {
                            return reply.conflict(doc._id + ' already exists');
                        }
                        return resolve();
                    });
                } else {
                    return resolve();
                }
            });

            /** fire the engine !
             */
            checkExistancePromise.then(function () {
                return Model.create(doc).save();
            }).then(function (savedData) {
                var results = {
                    data: (0, _utils.doc2jsonApi)(Model, savedData.attrs(), apiBaseUri),
                    links: {
                        self: apiBaseUri + '/' + Model.meta.names.plural + '/' + savedData._id
                    }
                };
                return reply.created(results).type('application/vnd.api+json');
            })['catch'](function (err) {
                if (err.name === 'ValidationError') {
                    return reply.badRequest(err.name + ': ' + err.extra, { failedDocument: payload });
                } else {
                    return reply.badImplementation(err);
                }
            });
        }
    },

    update: {
        method: ['PATCH'],
        path: '/{id}',
        handler: function handler(request, reply) {
            var payload = request.payload;
            var apiBaseUri = request.apiBaseUri;
            var db = request.db;

            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (parseError) {
                    return reply.badRequest('The payload should be a valid JSON', { payload: payload, parseError: parseError });
                }
            }

            var _joi$validate2 = _joi2['default'].validate(payload, jsonApiSchema);

            var validationError = _joi$validate2.error;

            if (validationError) {
                return reply.badRequest('malformed payload', validationError);
            }

            var jsonApiData = payload.data;
            var instance = request.pre.document;

            if (jsonApiData.attributes) {
                _lodash2['default'].forEach(jsonApiData.attributes, function (value, propertyName) {
                    if (value == null && value === '') {
                        instance.unset(propertyName);
                    } else {
                        instance.set(propertyName, value);
                    }
                });
            }

            if (jsonApiData.relationships) {
                var _iteratorNormalCompletion = true;
                var _didIteratorError = false;
                var _iteratorError = undefined;

                try {
                    for (var _iterator = _getIterator(_Object$keys(jsonApiData.relationships)), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                        var propertyName = _step.value;

                        var value = jsonApiData.relationships[propertyName];

                        if (!value.data) {
                            instance.unset(propertyName);
                        } else {
                            if (_lodash2['default'].isArray(value.data)) {
                                var _values = [];
                                var _iteratorNormalCompletion2 = true;
                                var _didIteratorError2 = false;
                                var _iteratorError2 = undefined;

                                try {
                                    for (var _iterator2 = _getIterator(value.data), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                                        var item = _step2.value;

                                        if (!db[item.type]) {
                                            return reply.badRequest('bad payload: unknown type "' + item.type + '" for the relation "' + propertyName + '"');
                                        }

                                        _values.push({
                                            _id: item.id,
                                            _type: item.type
                                        });
                                    }
                                } catch (err) {
                                    _didIteratorError2 = true;
                                    _iteratorError2 = err;
                                } finally {
                                    try {
                                        if (!_iteratorNormalCompletion2 && _iterator2['return']) {
                                            _iterator2['return']();
                                        }
                                    } finally {
                                        if (_didIteratorError2) {
                                            throw _iteratorError2;
                                        }
                                    }
                                }

                                value = _values;
                            } else {
                                if (!db[value.data.type]) {
                                    return reply.badRequest('bad payload: unknown type "' + value.data.type + '" for the relation "' + propertyName + '"');
                                }

                                value = {
                                    _id: value.data.id,
                                    _type: value.data.type
                                };
                            }
                            instance.set(propertyName, value);
                        }
                    }
                } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion && _iterator['return']) {
                            _iterator['return']();
                        }
                    } finally {
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                }
            }

            instance.save().then(function (savedDoc) {
                var results = {
                    data: (0, _utils.doc2jsonApi)(instance.Model, savedDoc.attrs(), apiBaseUri)
                };
                return reply.jsonApi(results);
            })['catch'](function (error) {
                if (error.name === 'ValidationError') {
                    var errorMessage = error.name;
                    if (error.extra) {
                        errorMessage = error.name + ': ' + error.extra;
                    }
                    return reply.badRequest(errorMessage, { failedDocument: payload });
                } else {
                    return reply.badImplementation(error);
                }
            });
        }
    },

    updateRelationships: {
        method: 'PATCH',
        path: '/{id}/relationships/{propertyName}',
        handler: function handler(request, reply) {
            var instance = request.pre.document;
            var propertyName = request.params.propertyName;

            var payload = request.payload;
            var db = request.db;

            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (parseError) {
                    return reply.badRequest('The payload should be a valid JSON', { payload: payload, parseError: parseError });
                }
            }

            if (payload.data == null) {
                instance.unset(propertyName);
            } else {
                var value = undefined;
                if (_lodash2['default'].isArray(payload.data)) {
                    value = [];
                    var _iteratorNormalCompletion3 = true;
                    var _didIteratorError3 = false;
                    var _iteratorError3 = undefined;

                    try {
                        for (var _iterator3 = _getIterator(payload.data), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                            var item = _step3.value;

                            if (!db[item.type]) {
                                return reply.badRequest('bad payload: unknown type "' + item.type + '" for the relation "' + propertyName + '"');
                            }
                            value.push({ _id: item.id, _type: item.type });
                        }
                    } catch (err) {
                        _didIteratorError3 = true;
                        _iteratorError3 = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion3 && _iterator3['return']) {
                                _iterator3['return']();
                            }
                        } finally {
                            if (_didIteratorError3) {
                                throw _iteratorError3;
                            }
                        }
                    }
                } else {
                    if (!db[payload.data.type]) {
                        return reply.badRequest('bad payload: unknown type "' + payload.data.type + '" for the relation "' + propertyName + '"');
                    }
                    value = { _id: payload.data.id, _type: payload.data.type };
                }
                instance.set(propertyName, value);
            }

            instance.save().then(function () {
                return reply.noContent();
            })['catch'](function (error) {
                if (error.name === 'ValidationError') {
                    return reply.badRequest(error.name + ': ' + error.extra);
                } else {
                    return reply.badImplementation(error);
                }
            });
        }
    },

    'delete': {
        method: 'DELETE',
        path: '/{id}',
        handler: function handler(request, reply) {
            request.pre.document['delete']().then(function () {
                return reply.noContent();
            })['catch'](function (err) {
                return reply.badImplementation(err);
            });
        }
    },

    deleteRelationships: {
        method: 'DELETE',
        path: '/{id}/relationships/{propertyName}',
        handler: function handler(request, reply) {
            var instance = request.pre.document;
            var propertyName = request.params.propertyName;

            var property = instance.Model.schema.getProperty(propertyName);

            if (!property) {
                return reply.notFound();
            }

            instance.unset(propertyName);

            instance.save().then(function () {
                return reply.noContent();
            })['catch'](function (error) {
                return reply.badImplementation(error);
            });
        }
    },

    groupBy: {
        method: 'GET',
        path: '/i/group-by/{property}',
        handler: function handler(request, reply) {
            var Model = request.Model;

            var property = request.params.property;

            var queryFilter = request.pre.queryFilter;

            Model.groupBy(property, queryFilter).then(function (data) {
                return reply.jsonApi({ data: data });
            })['catch'](function (err) {
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
                    format: _joi2['default'].string().only('json', 'jsonapi', 'csv', 'tsv').label('format')
                },
                query: {
                    // asJsonArray: joi.boolean()
                    delimiter: _joi2['default'].when('$params.format', {
                        is: _joi2['default'].valid('csv'),
                        then: _joi2['default'].string()['default'](','),
                        otherwise: _joi2['default'].forbidden()
                    }),
                    header: _joi2['default'].when('$params.format', {
                        is: _joi2['default'].valid('csv', 'tsv'),
                        then: _joi2['default'].boolean()['default'](true),
                        otherwise: _joi2['default'].forbidden()
                    }),
                    include: _joi2['default'].when('$params.format', {
                        is: _joi2['default'].valid('jsonapi'),
                        then: _joi2['default'].alternatives()['try'](_joi2['default'].number(), _joi2['default'].string()),
                        otherwise: _joi2['default'].forbidden()
                    })
                },
                failAction: function failAction(request, reply, source, error) {
                    var message = error.data.details.map(function (o) {
                        return o.message;
                    });
                    error.output.payload.message = message[0];
                    return reply(error);
                }
            }
        },
        handler: function handler(request, reply) {
            var _request$pre3 = request.pre;
            var queryFilter = _request$pre3.queryFilter;
            var queryOptions = _request$pre3.queryOptions;
            var Model = request.Model;
            var apiBaseUri = request.apiBaseUri;
            var db = request.db;
            var _request$query = request.query;
            var delimiter = _request$query.delimiter;
            var header = _request$query.header;
            var format = request.params.format;

            var contentType = undefined;
            if (format === 'tsv') {
                format = 'csv';
                delimiter = '\t';
                contentType = 'text/tab-separated-values';
            }

            var stream = undefined;
            try {
                stream = db.stream(Model.name, queryFilter, queryOptions);
            } catch (err) {
                if (err.name === 'ValidationError') {
                    return reply.badRequest(err);
                }
                return reply.badImplementation(err);
            }

            var resultStream = undefined;

            if (format === 'json') {
                contentType = 'application/json';

                var beginStream = new _stream.Readable();
                beginStream.push('{"data":[');
                beginStream.push(null);

                // TODO
                var jsonApiTransform = _eventStream2['default'].map(function (doc, callback) {
                    try {
                        doc = JSON.stringify(doc);
                        callback(null, doc);
                    } catch (err) {
                        callback(err);
                    }
                });

                var contentStream = stream.pipe(jsonApiTransform).pipe(_eventStream2['default'].join(','));

                var endStream = new _stream.Readable();
                endStream.push(']}');
                endStream.push(null);

                resultStream = (0, _streamStream2['default'])();
                resultStream.write(beginStream);
                resultStream.write(contentStream);
                resultStream.write(endStream);
                resultStream.end();
            } else if (format === 'csv') {
                if (!contentType) {
                    contentType = 'text/csv';
                }

                var csvOptions = {
                    fields: queryOptions.fields,
                    delimiter: delimiter,
                    header: header
                };

                try {
                    resultStream = (0, _utils.streamCSV)(Model, stream, csvOptions);
                } catch (err) {
                    return reply.badImplementation(err);
                }
            } else if (format === 'jsonapi') {
                format = 'json';
                contentType = 'application/vnd.api+json';

                var jsonApiOptions = {};
                var includeProperties = request.query.include;
                if (includeProperties) {
                    if (_lodash2['default'].isString(includeProperties)) {
                        includeProperties = includeProperties.split(',');
                    }
                    jsonApiOptions.include = { properties: includeProperties, included: [] };
                    jsonApiOptions.baseUri = apiBaseUri;
                }

                try {
                    resultStream = (0, _utils.streamJsonApi)(Model, stream, jsonApiOptions);
                } catch (err) {
                    return reply.badImplementation(err);
                }

                resultStream.on('error', function (error) {
                    console.log('ERRRROR', error);
                });
            }

            return reply.ok(resultStream).type(contentType).header('Content-Disposition', 'attachment; filename="' + Model.name + '.' + format + '"');
        }
    }
};

exports['default'] = function () {
    return routes;
};

module.exports = exports['default'];