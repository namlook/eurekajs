
import joi from 'joi';

const signupValidationSchema = {
    email: joi.string().email().required().label('email'),
    password: joi.string().min(5).required().label('password'),
    groups: joi.array().items(joi.string()).single().label('groups')
};


var checkUserExistanceMdw = function(req, res, next) {
    var {error, value: user} = joi.validate(req.body, signupValidationSchema);
    if (error) {
        return res.badRequest(error.details[0].message, error.details);
    }

    req.db.User.first({email: user.email}, function(err, existedUser) {
        if (err) {
            return res.serverError(err);
        }

        if (existedUser) {
            return res.conflict('user already exists');
        }

        req.attrs.user = user;

        next();
    });
};

export default {
    method: 'POST',
    path: '/',
    handler: [checkUserExistanceMdw, function(req, res) {

        var user = new req.db.User(req.attrs.user);

        user.save(function(err, savedUser) {
            if (err) {
                res.serverError(err);
            }

            res.created(savedUser.toJSONObject()); // TODO pojo() ?
        });
    }]
};