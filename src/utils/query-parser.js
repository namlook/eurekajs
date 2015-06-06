
import _ from 'lodash';
import TypeCaster from './type-caster';
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



    validate() {
        _.forOwn(this.query, (value, propertyName) => {

            if (_.isObject(value)) {
                _.forOwn(value, (val, operator) => {
                    this._validate(propertyName, val, operator);
                });
            } else {
                this._validate(propertyName, value);
            }
        });
    }

    _validate(propertyName, value, operator) {
        if (operator) {
            if (!_.contains(allowedOperators, operator)) {
                this._errors.push(`unknown operator ${operator}`);
            }
        }
        this._modelSchema.validate({[propertyName]: value});

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
                    query[propertyName][operator] = this._castValue(propertyName, val, true);
                });
            } else {
                query[propertyName] = this._castValue(propertyName, value);
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


    _castValue(propertyName, value, multi=false) {
        var propertyType;
        if (_.contains(specialPropertyNames, propertyName)) {
            propertyType = 'string';
        } else {
            let property = this._modelSchema.getProperty(propertyName);
            if (!property) {
                this._errors.push(`Can't find the property ${propertyName} from ${pascalCase(this.resourceName)}`);
                return null;
            }
            propertyType = this._modelSchema.getProperty(propertyName).type;
        }

        var results;
        if (multi) {
            results = TypeCaster.array(value, propertyType);
        } else {
            results = TypeCaster[propertyType](value);
        }

        return results;
    }




}