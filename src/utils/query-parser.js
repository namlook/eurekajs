
import _ from 'lodash';
import TypeCaster from './type-caster';
import {pascalCase} from './index';

var specialPropertyNames = ['_id', '_type', '_ref'];

export default class QueryParser {
    constructor(db, resourceName, reqQuery) {
        this.resourceName = resourceName;
        this.modelSchema = db[pascalCase(resourceName)].schema;
        this.db = db;
        this.rawQuery = reqQuery;
        this._options = {};
        this._query = {};
        this.processRawQuery();
    }

    processRawQuery() {
        Object.keys(this.rawQuery).forEach((property) => {

            if (property[0] === '_' && !_.contains(specialPropertyNames, property)) {
                this._options[_.trimLeft(property, '_')] = this.rawQuery[property];
            } else {
                this._query[property] = this.rawQuery[property];
            }
        });
    }

    parseValue(propertyName, value, multi=false) {

        var propertyType;
        if (_.contains(specialPropertyNames, propertyName)) {
            propertyType = 'string';
        } else {
            propertyType = this.modelSchema.getProperty(propertyName).type;
        }

        var results;
        if (multi) {
            results = TypeCaster.array(value, propertyType);
        } else {
            results = TypeCaster[propertyType](value);
        }

        return results;
    }

    get query() {
        var query = {};
        Object.keys(this._query).forEach((property) => {
            var value = this._query[property];
            if (_.isObject(value)) {
                query[property] = {};
                Object.keys(value).forEach((operator) => {
                    query[property][operator] = this.parseValue(property, value[operator], true);
                });
            } else {
                query[property] = this.parseValue(property, value);
            }
        });
        return query;
    }

    get options() {
        var options = this._options;
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
}