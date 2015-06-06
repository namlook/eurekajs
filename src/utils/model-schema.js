
import _ from 'lodash';

import joi from 'joi';

var constraints2joi = function(constraints, joiConstraint=null) {
    if (!joiConstraint) {
        joiConstraint = joi;
    }
    constraints.forEach(function(constraint) {
        if (_.isObject(constraint)) {
            var constraintKeys = Object.keys(constraint);

            if (constraintKeys.length > 1) {
                throw `the constraint ${constraint} must a have only one key`;
            }

            var constraintName = constraintKeys[0];

            if (!joiConstraint[constraintName]) {
                throw `unknown constaint ${constraintName}`;
            }

            var constraintParams = constraint[constraintName];

            if (!_.isArray(constraintParams)) {
                constraintParams = [constraintParams];
            }

            joiConstraint = joiConstraint[constraintName](...constraintParams);
        } else {
            if (!joiConstraint[constraint]) {
                throw `unknown constaint ${constraint}`;
            }
            joiConstraint = joiConstraint[constraint]();
        }
    });
    return joiConstraint;
};

var constraintsMonkeyPatch = function(validationConfig) {
    var modelType = validationConfig[0];

    if (modelType === 'integer') {
        validationConfig.unshift('number');
    } else if (modelType === 'float') {
        validationConfig.shift();
        validationConfig.unshift('number');
    } else if (modelType === 'datetime') {
        validationConfig.shift();
        validationConfig.unshift('date');
    }
};


class ModelProperty {
    constructor(name, config, modelSchema) {
        this.name = name;
        this.config = config;
        this.modelSchema = modelSchema;
    }

    get type() {
        return this.config.type;
    }

    get isRelation() {
        return !!this.modelSchema.db[this.type];
    }

    get isMulti() {
        return !!this.config.multi;
    }

    get multiValidations() {
        return _.isObject(this.config.multi) && this.config.multi.validations || [];
    }

    get validations() {
        let validations = this.config.validate || [];
        let validationConfig = [this.type].concat(validations);
        constraintsMonkeyPatch(validationConfig); // TODO remove when the archimedes type will be sanitized (number instead of integer)
        return validationConfig;
    }

    get _validator() {
        var propertyName = this.name;
        var constraints;

        if (this.isRelation) {
            constraints = joi.object({
                _id: joi.string().required().label(`${propertyName}._id`),
                _type: joi.string().required().label(`${propertyName}._type`)
            });
        } else {
            constraints = constraints2joi(this.validations);
        }


        if (this.isMulti) {
            constraints = joi.array().items(constraints);
            if (this.multiValidations.length) {
                constraints = constraints2joi(this.multiValidations, constraints);
            }
        }

        return constraints.label(this.name);
    }

    validate(value) {
        return this._validator.validate(value);
    }
}


export default class ModelSchema {
    constructor(name, schema, db) {
        this.name = name;
        this._schema = schema;
        this.db = db;
        this._properties = {};
        _.forOwn(this._schema.properties, (_propConfig, _propName) => {
            this._properties[_propName] = new ModelProperty(_propName, _propConfig, this);
        });
    }

    getProperty(propertyName) {
        if (_.contains(propertyName, '.')) {
            let relation = this._properties[propertyName.split('.')[0]];
            let relationSchema = this.db[relation.type].schema;
            let relationPropertyName = propertyName.split('.').slice(1).join('.');
            return relationSchema.getProperty(relationPropertyName);
        }

        return this._properties[propertyName];
    }

    hasProperty(propertyName) {
        return !!this.getProperty(propertyName);
    }

    validate(pojo, options, callback) {
        if (typeof options === 'function' && !callback) {
            callback = options;
            options = {};
        }

        if (!options) {
            options = {};
        }

        if (options.abortEarly == null) {
            options.abortEarly = false;
        }

        if (options.convert == null) {
            options.convert = true;
        }

        if (!callback) {
            return joi.validate(pojo, this._validator, options);
        }
        joi.validate(pojo, this._validator, options, callback);
    }

    get _validator() {
        var validator = {};
        _.forOwn(this._properties, (property, propertyName) => {
            validator[propertyName] = property._validator;
        });
        return validator;
    }
}