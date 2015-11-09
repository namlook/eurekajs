'use strict';

var _slicedToArray = require('babel-runtime/helpers/sliced-to-array')['default'];

var _getIterator = require('babel-runtime/core-js/get-iterator')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _stream = require('stream');

var _eventStream = require('event-stream');

var _eventStream2 = _interopRequireDefault(_eventStream);

var _streamStream = require('stream-stream');

var _streamStream2 = _interopRequireDefault(_streamStream);

var _csv = require('csv');

var _csv2 = _interopRequireDefault(_csv);

var pascalCase = function pascalCase(string) {
    return _lodash2['default'].capitalize(_lodash2['default'].camelCase(string));
};

exports.pascalCase = pascalCase;
var resourceObjectLink = function resourceObjectLink(modelClass, apiBaseUri, instance) {
    var id = encodeURIComponent(instance._id);
    return apiBaseUri + '/' + modelClass.meta.names.plural + '/' + id;
};

exports.resourceObjectLink = resourceObjectLink;
var csvStreamTransform = function csvStreamTransform(modelClass, options) {
    var properties = undefined;
    if (options.fields) {
        properties = [];
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = _getIterator(options.fields), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var propertyName = _step.value;

                var property = modelClass.schema.getProperty(propertyName);
                if (!property) {
                    throw new Error('fields: unknown property "' + propertyName + '"');
                }
                properties.push(property);
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
    } else {
        properties = modelClass.schema.properties;
    }

    properties = _lodash2['default'].sortBy(properties, 'name');

    return _eventStream2['default'].map(function (doc, callback) {

        var values = properties.map(function (property) {
            var value = doc[property.name];

            if (!_lodash2['default'].isArray(value)) {
                if (value != null) {
                    value = [value];
                } else {
                    value = [];
                }
            }

            if (property.isRelation()) {
                value = value.map(function (v) {
                    return v._id;
                });
            }

            if (property.type === 'date') {
                value = value.map(function (d) {
                    return d.toUTCString();
                });
            }

            return value.join('|');
        });

        values.unshift(doc._type);
        values.unshift(doc._id);

        var csvOptions = { delimiter: options.delimiter, eof: true };

        _csv2['default'].stringify([values], csvOptions, function (err, output) {
            if (err) {
                return callback(err);
            }

            return callback(null, output);
        });
    });
};

exports.csvStreamTransform = csvStreamTransform;
var streamCSV = function streamCSV(modelClass, stream, options) {

    var beginStream = undefined;
    if (options.header) {
        var csvHeader = modelClass.csvHeader(options);
        csvHeader = csvHeader + '\n';

        beginStream = new _stream.Readable();
        beginStream.push(csvHeader);
        beginStream.push(null);
    }

    var csvTransform = csvStreamTransform(modelClass, options);

    var contentStream = stream.pipe(csvTransform); //.pipe(es.join('\n'));

    var resultStream = (0, _streamStream2['default'])();
    if (beginStream) {
        resultStream.write(beginStream);
    }
    resultStream.write(contentStream);
    resultStream.end();

    return resultStream;
};

exports.streamCSV = streamCSV;
var doc2jsonApi = function doc2jsonApi(modelClass, doc, apiBaseUri, include) {
    var attributes = {};
    var relationships = {};

    var baseUri = undefined;
    if (apiBaseUri) {
        baseUri = resourceObjectLink(modelClass, apiBaseUri, doc);
    }

    if (_lodash2['default'].isArray(include)) {
        include = { properties: true, included: include };
    }

    var _ref = include || {};

    var includedProperties = _ref.properties;
    var included = _ref.included;

    if (includedProperties === 1) {
        includedProperties = true;
    }

    if (includedProperties && !_lodash2['default'].isArray(includedProperties) && !_lodash2['default'].isBoolean(includedProperties)) {
        includedProperties = [includedProperties];
    }

    if (included && !_lodash2['default'].isArray(included)) {
        throw new Error('toJsonApi(): included should be an array');
    }

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
        for (var _iterator2 = _getIterator(modelClass.schema.properties), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var property = _step2.value;

            var value = doc[property.name];

            var shouldBeIncluded = _lodash2['default'].isBoolean(includedProperties) && includedProperties || _lodash2['default'].includes(includedProperties, property.name);

            if (property.isRelation()) {
                if (property.isArray()) {
                    if (value && !_lodash2['default'].isEmpty(value)) {
                        var _values = [];
                        var _iteratorNormalCompletion3 = true;
                        var _didIteratorError3 = false;
                        var _iteratorError3 = undefined;

                        try {
                            for (var _iterator3 = _getIterator(value), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                                var item = _step3.value;

                                var rel = { id: item._id, type: item._type };

                                if (shouldBeIncluded) {
                                    var ref = rel.type + ':::' + rel.id;
                                    if (included.indexOf(ref) === -1) {
                                        included.push(ref);
                                    }
                                }
                                _values.push(rel);
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

                        value = _values;
                    } else {
                        value = null;
                    }
                } else if (value) {
                    value = { id: value._id, type: value._type };

                    if (shouldBeIncluded) {
                        var ref = value.type + ':::' + value.id;
                        if (included.indexOf(ref) === -1) {
                            included.push(ref);
                        }
                    }
                }

                if (value != null) {
                    var relationshipsData = {
                        data: value
                    };

                    if (baseUri) {
                        relationshipsData.links = {
                            self: baseUri + '/relationships/' + property.name,
                            related: baseUri + '/' + property.name
                        };
                    }

                    relationships[property.name] = relationshipsData;
                }
            } else {
                if (value != null) {
                    attributes[property.name] = value;
                }
            }
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

    var jsonApiData = {
        id: doc._id,
        type: doc._type
    };

    if (!_lodash2['default'].isEmpty(attributes)) {
        jsonApiData.attributes = attributes;
    }

    if (!_lodash2['default'].isEmpty(relationships)) {
        jsonApiData.relationships = relationships;
    }

    return jsonApiData;
};

exports.doc2jsonApi = doc2jsonApi;
var jsonApiStreamTransform = function jsonApiStreamTransform(modelClass, include /*, baseUri*/) {

    return _eventStream2['default'].map(function (doc, callback) {
        var jsonApiData = doc2jsonApi(modelClass, doc, null, include);
        callback(null, JSON.stringify(jsonApiData));
    });
};

exports.jsonApiStreamTransform = jsonApiStreamTransform;
var streamJsonApi = function streamJsonApi(modelClass, stream, options) {
    var include /*, baseUri*/ = options.include;

    var beginStream = new _stream.Readable();
    beginStream.push('{"data": [');
    beginStream.push(null);

    var endStream = new _stream.Readable();
    endStream.push(']}');
    endStream.push(null);

    var includeBeginStream = new _stream.Readable();
    includeBeginStream.push('],"included": [');
    includeBeginStream.push(null);

    var jsonApiTransform = jsonApiStreamTransform(modelClass, include);

    var contentStream = stream.pipe(jsonApiTransform).pipe(_eventStream2['default'].join(','));

    var resultStream = (0, _streamStream2['default'])();

    contentStream.on('end', function () {

        /*
         * fetch the include relationships
         */
        if (include) {
            var includeStream = _eventStream2['default'].readable(function (count, next) {
                if (count >= include.included.length) {
                    return this.emit('end');
                }
                var ref = include.included[count] + ':::' + count;
                this.emit('data', ref);
                next();
            }).pipe(_eventStream2['default'].map(function (ref, callback) {
                var _ref$split = ref.split(':::');

                var _ref$split2 = _slicedToArray(_ref$split, 3);

                var type = _ref$split2[0];
                var id = _ref$split2[1];
                var index = _ref$split2[2];

                var db = modelClass.db;
                db.fetch(type, id).then(function (doc) {
                    if (!doc) {
                        console.error(type + ': "' + id + '" not found');
                        return callback(null, null);
                    }
                    var jsonApiDoc = doc2jsonApi(db[type], doc);
                    var result = JSON.stringify(jsonApiDoc);
                    if (index > 0) {
                        result = ',' + result;
                    }
                    callback(null, result);
                })['catch'](function (err) {
                    callback(err);
                });
            }));

            includeStream.on('error', function (error) {
                console.error('xxx', error);
            });

            resultStream.write(includeBeginStream);
            resultStream.write(includeStream);
        }

        resultStream.write(endStream);
        resultStream.end();
    });

    resultStream.write(beginStream);
    resultStream.write(contentStream);

    resultStream.on('error', function (error) {
        console.error('xxx!!!!', error);
        console.error('xxx!!!!', error.stack);
    });

    return resultStream;
};
exports.streamJsonApi = streamJsonApi;