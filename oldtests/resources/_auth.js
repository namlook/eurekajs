
// import joi from 'joi';
// import passport from 'passport';
// import {BasicStrategy} from 'passport-http';
// import {Strategy as JwtStrategy} from 'passport-jwt';
// import jwt from 'jsonwebtoken';

// const signupValidationSchema = {
//     email: joi.string().email().required().label('email'),
//     password: joi.string().min(5).required().label('password')
// };

// var checkUserExistanceMdw = function(req, res, next) {
//     var {error, value: user} = joi.validate(req.body, signupValidationSchema);
//     if (error) {
//         return res.badRequest(error, error.details);
//     }

//     req.db.User.first({email: user.email}, function(err, existedUser) {
//         if (err) {
//             return res.serverError(err);
//         }

//         if (existedUser) {
//             return res.conflict('user already exists');
//         }

//         req.attrs.user = user;

//         next();
//     });
// };


// var setupBasicAutentication = function(server) {
//     passport.use(new BasicStrategy(
//         {},
//         function(email, password, done) {
//             // Find the user by username.  If there is no user with the given
//             // username, or the password is not correct, set the user to `false` to
//             // indicate failure.  Otherwise, return the authenticated `user`.
//             console.log('fetching', email);
//             server.database.User.first({email: email}, function(err, user) {
//                 if (err) {
//                     return done(err);
//                 }

//                 if (!user) {
//                     return done(null, false);
//                 }

//                 if (user.get('password') !== password) { // TODO bcrypt and salt
//                     return done(null, false);
//                 }

//                 return done(null, user);
//             });
//         }
//     ));
// };


// var setupJwtAutentication = function(server) {
//     passport.use(new JwtStrategy(
//         {secretOrKey: server.config.secret},
//         function(jwtPayload, done) {
//             server.database.User.first({_id: jwtPayload.userId}, function(err, user) {
//                 if (err) {
//                     return done(err, false);
//                 }

//                 if (user) {
//                     done(null, user);
//                 } else {
//                     done(null, false);
//                 }
//             });
//         })
//     );
// };

// var isAuthenticated = (function() {
//     return passport.authenticate('jwt', { session: false });
// })();

// module.exports = {
//     pathPrefix: '/auth',
//     middlewares: function(resource) {
//         setupJwtAutentication(resource.server);
//         setupBasicAutentication(resource.server);
//         return [passport.initialize()];
//     },
//     routes: {
//         signup: {
//             path: '/signup',
//             method: 'POST',
//             beforeHandler: [checkUserExistanceMdw],
//             handler: function(req, res) {

//                 var user = new req.db.User(req.attrs.user);

//                 user.save(function(err, savedUser) {
//                     if (err) {
//                         res.serverError(err);
//                     }

//                     res.created(savedUser.toJSONObject()); // TODO pojo() ?
//                 });

//             }
//         },

//         login: {
//             path: '/',
//             method: 'POST',
//             beforeHandler: [passport.authenticate('basic', {session: false})],
//             handler: function(req, res) {
//                 console.log('>>> logged in', req.user.get('_id'));
//                 let secret = req.server.config.secret;
//                 let payload = {userId: req.user.get('_id')};
//                 let token = jwt.sign(payload, secret);
//                 return res.ok({token: token});
//             }
//         },

//         secret: {
//             path: '/secret',
//             method: 'GET',
//             beforeHandler: [isAuthenticated],
//             handler: function(req, res) {
//                 res.ok('secret something');
//             }
//         }
//     }
// };