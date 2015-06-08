
import _ from 'lodash';
// import TypeCaster from './type-caster';
import {pascalCase} from './index';

var specialPropertyNames = ['_id', '_type', '_ref'];
var allowedOperators = [
    '$eq',
    '$lt',
    '$lte',
    '$gt',
    '$gte',
    '$regex',
    '$iregex',
    '$year',
    '$month',
    '$day',
    '$ne',
    '$in',
    '$nin',
    '$all',
    '$nall',
    '$exists'
];

var arrayOperators = ['$all', '$nall', '$in', '$nin'];


export default class QueryParser {
    constructor(db, resourceName, reqQuery) {
        this.resourceName = resourceName;
        this._modelSchema = db[pascalCase(resourceName)].schema;
        this.process(reqQuery);
    }

    /** return the errors found during the process **/
    get errors() {
        if (this._errors.length) {
            return this._errors;
        }
    }

    /** process the request's query into two attributes: query and options **/
    process(reqQuery) {
        this._errors = [];
        var {rawQuery, rawOptions} = this._dispatch(reqQuery);
        this.query = this._processQuery(rawQuery);
        this.options = this._processOptions(rawOptions);
    }


    validate(value, propertyName, operator) {
        if (operator) {
            if (!_.contains(allowedOperators, operator)) {
                this._errors.push(`unknown operator ${operator}`);
            }
        }

        var property = this._modelSchema.getProperty(propertyName);

        if (!property) {
            this._errors.push(`Can't find the property ${propertyName} from ${pascalCase(this.resourceName)}`);
            return null;
        }

        var castedValue;
        if (_.isArray(value)) {
            castedValue = [];
            var validation;
            value.forEach((val) => {
                validation = property.validate(val);
                if (validation.error) {
                    validation.error.details.forEach((detail) => {
                        this._errors.push(detail.message);
                    });
                } else {
                    castedValue.push(validation.value);
                }
            });
        } else {
            validation = property.validate(value);
            if (validation.error) {
                validation.error.details.forEach((detail) => {
                    this._errors.push(detail.message);
                });
            } else {
                castedValue = validation.value;
            }
        }
        return castedValue;
    }


    /** extract the parameters from the the request's query and dispatch them
     * into query and options
     */
    _dispatch(reqQuery) {
        var rawQuery = {};
        var rawOptions = {};
        _.forOwn(reqQuery, (value, propertyName) => {
            if (propertyName[0] === '_' && !_.contains(specialPropertyNames, propertyName)) {
                rawOptions[_.trimLeft(propertyName, '_')] = value;
            } else {
                rawQuery[propertyName] = value;
            }
        });
        return {rawQuery, rawOptions};
    }


    _processQuery(rawQuery) {
        var query = {};
        _.forOwn(rawQuery, (value, propertyName) => {
            if (_.isObject(value)) {
                query[propertyName] = {};
                _.forOwn(value, (val, operator) => {
                    if (_.contains(arrayOperators, operator)) {
                        val = val.split(',');
                    }
                    query[propertyName][operator] = this.validate(val, propertyName, operator);
                });
            } else {
                query[propertyName] = this.validate(value, propertyName);
            }
        });
        return query;
    }

    _processOptions(rawOptions) {
        var options = rawOptions;
        options.limit = options.limit && _.parseInt(options.limit) || 30;
        options.sortBy = options.sortBy && options.sortBy.split(',') || undefined;
        options.fields = options.fields && options.fields.split(',') || undefined;

        var populate = options.populate;
        if (populate) {
            if (isNaN(_.parseInt(populate))) {
                options.populate = populate.split(',');
            } else {
                options.populate = 1;
            }
        }
        return options;
    }


    // _castValue(propertyName, value, multi=false) {
    //     var propertyType;
    //     if (_.contains(specialPropertyNames, propertyName)) {
    //         propertyType = 'string';
    //     } else {
    //         let property = this._modelSchema.getProperty(propertyName);
    //         if (!property) {
    //             this._errors.push(`Can't find the property ${propertyName} from ${pascalCase(this.resourceName)}`);
    //             return null;
    //         }
    //         propertyType = this._modelSchema.getProperty(propertyName).type;
    //     }

    //     var results;
    //     if (multi) {
    //         results = TypeCaster.array(value, propertyType);
    //     } else {
    //         results = TypeCaster[propertyType](value);
    //     }

    //     return results;
    // }




}