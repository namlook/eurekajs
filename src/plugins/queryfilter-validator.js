
import _ from 'lodash';
import joi from 'joi';
import {pascalCase} from '../utils';

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

// var arrayOperators = ['$all', '$nall', '$in', '$nin'];

var operatorValidator = {
    $eq: joi.any(),
    $gt: joi.number(),
    $lt: joi.number(),
    $gte: joi.number(),
    $lte: joi.number(),
    $regex: joi.string(),
    $iregex: joi.string(),
    $ne: joi.any(),
    $in: [joi.array(joi.any()).min(1)],
    $nin: [joi.array(joi.any()).min(1)],
    $all: [joi.array(joi.any()).min(1)],
    $nall: [joi.array(joi.any()).min(1)],
    $exists: joi.boolean(),

    // to remove later ?
    $year: joi.number(),
    $month: joi.number(),
    $day: joi.number()
};

class QueryFilterValidator {
    constructor(db, modelSchema) {
        this._modelSchema = modelSchema;
        this._db = db;
        this.errors = [];
    }

    _validateValue(value, propertyName, operator) {
        if (operator) {
            if (!_.contains(allowedOperators, operator)) {
                this.errors.push(`unknown operator ${operator}`);
            }
        }

        var property = this._modelSchema.getProperty(propertyName);

        if (!property) {
            this.errors.push(`unknown property ${propertyName} for model ${pascalCase(this._modelSchema.name)}`);
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
                        this.errors.push(detail.message);
                    });
                } else {
                    castedValue.push(validation.value);
                }
            });
        } else {
            validation = property.validate(value);
            if (validation.error) {
                validation.error.details.forEach((detail) => {
                    this.errors.push(detail.message);
                });
            } else {
                castedValue = validation.value;
            }
        }
        return castedValue;
    }

    validate(queryFilter) {
        var filter = {};

        _.forOwn(queryFilter, (value, propertyName) => {

            if (_.contains(propertyName, '.')) {

                let relationName = propertyName.split('.')[0];
                let relationPropertyName = propertyName.split('.').slice(1);
                let propRelation = this._modelSchema.getProperty(relationName);
                let relationValidator = new QueryFilterValidator(this._db, this._db[propRelation.type].schema);
                let relfilter = relationValidator.validate({[relationPropertyName]: value});
                _.forOwn(relfilter, (relValue, relName) => {
                    filter[`${relationName}.${relName}`] = relValue;
                });
                this.errors = this.errors.concat(relationValidator.errors);

            } else if (_.isObject(value)) {

                let validation = joi.validate(value, operatorValidator);
                if (validation.error) {
                    this.errors.push(validation.error);
                }
                _.forOwn(validation.value, (val, operator) => {
                    _.set(filter, `${propertyName}.${operator}`, this._validateValue(val, propertyName, operator));
                });

            } else {

                _.set(filter, propertyName, this._validateValue(value, propertyName));

            }
        });

        return filter;
    }
}

export default function(db, modelSchema, queryFilter) {
    let validator = new QueryFilterValidator(db, modelSchema);
    let value = validator.validate(queryFilter);
    let errors = validator.errors;
    return {value, errors};
}
