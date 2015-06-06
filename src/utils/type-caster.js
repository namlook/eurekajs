/* eslint key-spacing: 0 */

import _ from 'lodash';

export default class TypeCaster {

    static integer(value) {
        if (_.isNumber(value)) {
            return value;
        }

        var val = parseInt(value, 10);
        if (isNaN(val)) {
            throw `TypeCaster: error, the value ${value} should be an Integer or a String`;
        }
        return val;
    }

    static float(value) {
        if (_.isNumber(value)) {
            return value;
        }

        var val = parseFloat(value);
        if (isNaN(val)) {
            throw `TypeCaster error, the value ${value} should be a Float or a String`;
        }
        return val;
    }

    static boolean(value) {
        if (_.isBoolean(value)) {
            return value;
        }

        var correspondances = {
            'true'  : true,
            '1'     : true,
            'on'    : true,
            'yes'   : true,
            'false' : false,
            '0'     : false,
            'off'   : false,
            'no'    : false
        };

        var val = correspondances[_(value).toString().toLowerCase()];

        if (val == null) {
            throw `TypeCase error, value is null or undefined and should be a Boolean or a String`;
        }

        return val;
    }

    static string(value) {
        return _(value).toString();
    }

    static array(value, subtype) {
        if (_.isArray(value)) {
            return value;
        }

        if (!_.isString(value)) {
            throw `TypeCast error: the value ${value} is not an Array or a String`;
        }

        return value.split(',').map((item) => {
            return this[subtype](item);
        });

    }
}