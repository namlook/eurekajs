import _ from 'lodash';

import {Readable} from 'stream';
import es from 'event-stream';
import streamStream from 'stream-stream';

import csv from 'csv';


export var pascalCase = function(string) {
    return _.capitalize(_.camelCase(string));
};

export var resourceObjectLink = function(modelClass, apiBaseUri, instance) {
    let id = encodeURIComponent(instance._id);
    return `${apiBaseUri}/${modelClass.meta.names.plural}/${id}`;
};


export var csvStreamTransform = function(modelClass, options) {
    let properties;
    if (options.fields) {
        properties = [];
        for (let propertyName of options.fields) {
            let property = modelClass.schema.getProperty(propertyName);
            if (!property) {
                throw new Error(`fields: unknown property "${propertyName}"`);
            }
            properties.push(property);
        }
    } else {
        properties = modelClass.schema.properties;
    }

    properties = _.sortBy(properties, 'name');

    return es.map((doc, callback) => {

        let values = properties.map((property) => {
            let value = doc[property.name];

            if (!_.isArray(value)) {
                if (value != null) {
                    value = [value];
                } else {
                    value = [];
                }
            }

            if (property.isRelation()) {
                value = value.map((v) => v._id);
            }

            if (property.type === 'date') {
                value = value.map((d) => d.toUTCString());
            }

            return value.join('|');
        });

        values.unshift(doc._type);
        values.unshift(doc._id);

        let csvOptions = {delimiter: options.delimiter, eof: true};

        csv.stringify([values], csvOptions, (err, output) => {
            if (err) {
                return callback(err);
            }

            return callback(null, output);
        });
    });
};

export let streamCSV = function(modelClass, stream, options) {

    let beginStream;
    if (options.header) {
        let csvHeader = modelClass.csvHeader(options);
        csvHeader = `${csvHeader}\n`;

        beginStream = new Readable();
        beginStream.push(csvHeader);
        beginStream.push(null);
    }

    let csvTransform = csvStreamTransform(modelClass, options);

    let contentStream = stream.pipe(csvTransform);//.pipe(es.join('\n'));

    let resultStream = streamStream();
    if (beginStream) {
        resultStream.write(beginStream);
    }
    resultStream.write(contentStream);
    resultStream.end();

    return resultStream;
};


export let doc2jsonApi = function(modelClass, doc, apiBaseUri, include) {
    let attributes = {};
    let relationships = {};

    let baseUri;
    if (apiBaseUri) {
        baseUri = resourceObjectLink(modelClass, apiBaseUri, doc);
    }

    if (_.isArray(include)) {
        include = {properties: true, included: include};
    }

    let {properties: includedProperties, included} = include || {};

    if (includedProperties === 1) {
        includedProperties = true;
    }

    if (includedProperties && !_.isArray(includedProperties) && !_.isBoolean(includedProperties)) {
        includedProperties = [includedProperties];
    }

    if (included && !_.isArray(included)) {
        throw new Error('toJsonApi(): included should be an array');
    }

    for (let property of modelClass.schema.properties) {
        let value = doc[property.name];

        let shouldBeIncluded = (
            _.isBoolean(includedProperties) &&
            includedProperties) || _.includes(includedProperties, property.name
        );

        if (property.isRelation()) {
            if (property.isArray()) {
                if (value && !_.isEmpty(value)) {
                    let _values = [];
                    for (let item of value) {
                        let rel = {id: item._id, type: item._type};

                        if (shouldBeIncluded) {
                            let ref = `${rel.type}:::${rel.id}`;
                            if (included.indexOf(ref) === -1) {
                                included.push(ref);
                            }
                        }
                        _values.push(rel);
                    }
                    value = _values;
                } else {
                    value = null;
                }
            } else if (value) {
                value = {id: value._id, type: value._type};

                if (shouldBeIncluded) {
                    let ref = `${value.type}:::${value.id}`;
                    if (included.indexOf(ref) === -1) {
                        included.push(ref);
                    }
                }
            }

            if (value != null) {
                let relationshipsData = {
                    data: value
                };

                if (baseUri) {
                    relationshipsData.links = {
                        self: `${baseUri}/relationships/${property.name}`,
                        related: `${baseUri}/${property.name}`
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

    let jsonApiData = {
        id: doc._id,
        type: doc._type
    };

    if (!_.isEmpty(attributes)) {
        jsonApiData.attributes = attributes;
    }

    if (!_.isEmpty(relationships)) {
        jsonApiData.relationships = relationships;
    }

    return jsonApiData;
};


export let jsonApiStreamTransform = function(modelClass, include/*, baseUri*/) {

    return es.map((doc, callback) => {
        let jsonApiData = doc2jsonApi(modelClass, doc, null, include);
        callback(null, JSON.stringify(jsonApiData));
    });
};


export let streamJsonApi = function(modelClass, stream, options) {

    let {include/*, baseUri*/} = options;


    let beginStream = new Readable();
    beginStream.push('{"data": [');
    beginStream.push(null);

    let endStream = new Readable();
    endStream.push(']}');
    endStream.push(null);

    let includeBeginStream = new Readable();
    includeBeginStream.push('],"included": [');
    includeBeginStream.push(null);

    let jsonApiTransform = jsonApiStreamTransform(modelClass, include);

    let contentStream = stream
        .pipe(jsonApiTransform)
        .pipe(es.join(','));

    let resultStream = streamStream();


    contentStream.on('end', function() {

        /*
         * fetch the include relationships
         */
        if (include) {
            let includeStream = es.readable(function(count, next) {
                if (count >= include.included.length) {
                    return this.emit('end');
                }
                let ref = `${include.included[count]}:::${count}`;
                this.emit('data', ref);
                next();

            }).pipe(es.map((ref, callback) => {
                let [type, id, index] = ref.split(':::');
                let db = modelClass.db;
                db.fetch(type, id).then((doc) => {
                    if (!doc) {
                        console.error(`${type}: "${id}" not found`);
                        return callback(null, null);
                    }
                    let jsonApiDoc = doc2jsonApi(db[type], doc);
                    let result = JSON.stringify(jsonApiDoc);
                    if (index > 0) {
                        result = `,${result}`;
                    }
                    callback(null, result);
                }).catch((err) => {
                    callback(err);
                });
            }));


            includeStream.on('error', function(error) {
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

    resultStream.on('error', function(error) {
        console.error('xxx!!!!', error);
        console.error('xxx!!!!', error.stack);
    });

    return resultStream;

};
