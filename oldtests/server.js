
require('source-map-support').install();

var EurekaServer = require('../lib/server');
var registerEurekaMiddlewares = require('../lib/middlewares');
var requireDir = require('require-dir');

// var FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET;


var server = new EurekaServer({
    name: 'Test',
    version: 1,
    port: 4000,
    database: {
        adapter: 'rdf',
        config: {
            store: 'virtuoso',
            host: '192.168.99.100',
            graphURI: 'http://test.org'
        }
    },
    secret: 'THE SECRET SHOULD BE SAFE',
    resources: requireDir('./resources'),
    schemas: requireDir('./schemas'),
    plugins: {
        auth: {
            plugin: authPlugin,
            config: {
                propertyAliases: {
                    login: 'username',
                    email: 'email',
                    password: 'pwd'
                }
            }
        }
    }
    // authentification: {
    //     model: 'user',
    //     services: {
    //         basic: {
    //             propertyAliases: {
    //                 email: 'email',
    //                 username: 'login',
    //                 password: 'password'
    //             }
    //         },
    //         digest: {
    //             options: {
    //                 qop: 'auth',
    //                 propertyAliases: {
    //                     email: 'email',
    //                     username: 'login',
    //                     password: 'password'
    //                 }
    //             }
    //         },
    //         facebook: {
    //             clientID: FACEBOOK_APP_ID,
    //             clientSecret: FACEBOOK_APP_SECRET,
    //             callbackURL: 'http://www.example.com/auth/facebook/callback',
    //             options: {
    //                 successRedirect: '/',
    //                 failureRedirect: '/login'
    //             },
    //             propertyAliases: {
    //                 accessToken: 'authFacebookAcessToken',
    //                 refreshToken: 'authFacebookrefreshToken'
    //             }
    //         },
    //         twitter: {
    //             consumerKey: TWITTER_CONSUMER_KEY,
    //             consumerSecret: TWITTER_CONSUMER_SECRET,
    //             callbackURL: 'http://www.example.com/auth/twitter/callback',
    //             options: {
    //                 successRedirect: '/',
    //                 failureRedirect: '/login'
    //             },
    //             propertyAliases: {
    //                 token: 'authTwitterToken',
    //                 tokenSecret: 'authTwitterSecretToken'
    //             }
    //         },
    //         google: {
    //             returnURL: 'http://www.example.com/auth/google/return',
    //             realm: 'http://www.example.com/',
    //             propertyAliases: {
    //                 identifier: 'authGoogleIdentifier'

    //             }
    //         }
    //     }
    // }
});

registerEurekaMiddlewares(server);

let authPlugin = require('./plugins/eureka-server-auth');
let testPlugin = require('./plugins/test-plugin');

server.registerPlugins([
    {'auth': authPlugin},
    {'test': testPlugin}
]);

module.exports = server;

if (require.main === module) {
    server.start();
}