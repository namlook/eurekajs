

import passport from 'passport';
import {BasicStrategy} from 'passport-http';
import {Strategy as JwtStrategy} from 'passport-jwt';


var setupAutentication = function(server) {
    passport.use(new BasicStrategy(
        {},
        function(email, password, done) {
            // Find the user by username.  If there is no user with the given
            // username, or the password is not correct, set the user to `false` to
            // indicate failure.  Otherwise, return the authenticated `user`.
            console.log('fetching', email);
            server.database.User.first({email: email}, function(err, user) {
                if (err) {
                    return done(err);
                }

                if (!user) {
                    return done(null, false);
                }

                if (user.get('password') !== password) { // TODO bcrypt and salt
                    return done(null, false);
                }

                return done(null, user);
            });
        }
    ));

    passport.use(new JwtStrategy(
        {secretOrKey: server.config.secret},
        function(jwtPayload, done) {
            server.database.User.first({_id: jwtPayload.userId}, function(err, user) {
                if (err) {
                    return done(err, false);
                }

                if (user) {
                    done(null, user);
                } else {
                    done(null, false);
                }
            });
        })
    );
};

// var isAuthenticated = (function() {
//     return passport.authenticate('jwt', { session: false });
// })();

var policies = function(req, res, next) {
    next();
};

export default function(server) {

    setupAutentication(server);
    server.use(passport.initialize());

    server.use(policies);

    return {
        resources: {
            auth: require('./resources/auth')
        },
        schemas: null
    };
}