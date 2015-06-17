// import Hapi from 'hapi';
// // import Good from 'good';
// // import GoodConsole from 'good-console';

// import eurekaPlugin from './plugins/eureka';
// import archimedesPlugin from './plugins/archimedes';


// var config = {
//     name: 'Test',
//     version: 1,
//     port: 5000,
//     database: {
//         adapter: 'rdf',
//         config: {
//             store: 'virtuoso',
//             host: '192.168.99.100',
//             graphURI: 'http://test.org'
//         },
//         schemas: {} //requireDir('./schemas'),
//     },
//     secret: 'THE SECRET SHOULD BE SAFE',
//     resources: ['generic'] //requireDir('./resources'),
// };



// /**
//  * building the server
//  */
// var server = new Hapi.Server();


// /**
//  * listen to all logs events
//  */
// server.on('log', function(message) {
//     console.log(message.tags, message.data);
// });

// /**
//  * start a connection on the specified port
//  */
// server.connection({ port: config.port });


// /**
//  * register plugins
//  */
// server.register([

//     /**
//      * database plugin
//      */
//     {
//         register: archimedesPlugin,
//         options: config.database
//     },

//     /**
//      * eureka plugin
//      */
//     {
//         register: eurekaPlugin,
//         options: config.resources
//     }

// ], function(pluginErrors) {

//     if (pluginErrors) {
//         throw pluginErrors;
//     }
// });


// var registerResources = function(pathToResources) {
//     return [];
// };

// server.register(registerResources('./resources'), function(resourcesError) {
//     if (resourcesError) {
//         throw resourcesError;
//     }

//     /**
//      * finally starts the server
//      */
//     server.start(function(startError) {
//         if (startError) {
//             throw startError;
//         }

//         server.log('info', `Server running at: http://${server.info.address}:${server.info.port}`);

//     });
// });



// // var server = new Hapi.Server();
// // server.connection({ port: 5000 });

// // server.on('log', function(message) {
// //     console.log(message.tags, message.data);
// // });

// // server.register([
// //     {
// //         register: archimedesPlugin,
// //         options: {
// //             adapter: 'rdf',
// //             config: {
// //                 store: 'virtuoso',
// //                 host: '192.168.99.100',
// //                 graphURI: 'http://test.org'
// //             },
// //             schemas: {Generic: {}}
// //         }
// //     },
// //     {
// //         register: eurekaPlugin,
// //         options: {
// //             resources: ['generic', 'generic-relation']
// //         }
// //     }
// //     // {
// //     //     register: Good,
// //     //     options: {
// //     //         reporters: [{
// //     //             reporter: GoodConsole,
// //     //             events: {
// //     //                 response: '*',
// //     //                 log: '*'
// //     //             }
// //     //         }]
// //     //     }
// //     // }
// //     ], function (err) {
// //         if (err) {
// //             throw err; // something bad happened loading the plugin
// //         }

// //         server.start(function (startError) {
// //             if (startError) {
// //                 throw startError;
// //             }
// //             server.log('info', 'Server running at: ' + server.info.uri);
// //         });
// // });