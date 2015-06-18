
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


export default class ModelSchemaProperty {
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

    get propagateDeletion() {
        return !!this.config.propagateDeletion;
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

    fixture() {
        var value;
        if (this.isRelation) {
            return undefined;
        }
        if (this.isMulti) {
            value = [];
            for (let i = 0; i < _.random(1, 8); i++) {
                value.push(this._getFixtureValue());
            }
        } else {
            value = this._getFixtureValue();
        }
        return value;
    }

    _fixtureValue() {
        if (this.config.fixture) {
            return this.config.fixture();
        }

        // generate fixture from type
        var today = new Date();
        var lorem = _.words('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.');
        var pickInLorem = _.random(0, 40);
        var type2faker = {
            string: lorem.slice(pickInLorem, pickInLorem + _.random(4, 10)).join(' '),
            number: _.random(0, 100, true),
            integer: _.random(0, 100), // TODO REMOVE
            float: _.random(0, 100, true), // TODO REMOVE
            boolean: Boolean(_.random()),
            date: new Date(today.getFullYear(), today.getMonth(), _.random(1, 29)),
            datetime: new Date(today.getFullYear(), today.getMonth(), _.random(1, 29), _.random(1, 23), _.random(1, 59), _.random(1, 59))
        };
        return type2faker[this.type];
    }
}