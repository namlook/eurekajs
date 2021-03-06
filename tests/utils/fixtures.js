
import Bcrypt from 'bcrypt';
import _ from 'lodash';
import Promise from 'bluebird';

// import eureka from '../../lib';
// import config from '../config';

let fixtures = {

    clear: function(server) {
        return Promise.resolve().then(() => {

            var database = server.plugins.eureka.database;
            return database.clear();
        });
    },

    genericDocuments: function(server) {
        return Promise.resolve().then(() => {

        var database = server.plugins.eureka.database;


        var relations = _.range(15).map((index) => {
            return {
                _id: `relation${index}`,
                _type: 'GenericRelation',
                text: `relation ${index}`
            };
        });


        var generics = _.range(1, 11).map((i) => {
            return {
                _id: `generic${i}`,
                _type: 'Generic',
                text: `hello world ${i}`,
                boolean: i % 2,
                integer: i,
                float: i + 0.14,
                date: new Date(Date.UTC(1984, 7, i)),
                relation: {_id: relations[i % 2]._id, _type: 'GenericRelation'},
                relations: _.range(4).map((item) => {
                    let index = item - i;
                    if (index < 0) {
                        index = index * -1;
                    }
                    return {_id: relations[index % 5]._id, _type: 'GenericRelation'};
                })
            };
        });


        var publicStuff = [];
        for (let i = 0; i < 10; i++) {
            publicStuff.push({
                _id: `publicstaff${i}`,
                _type: 'PublicStaff',
                title: `public hello ${i}`
            });
        }

        // publicStuff = publicStuff.map(function(pojo) {
        //     return new database.PublicStuff(pojo).toSerializableObject();
        // });

            return Promise.all([
                database.batchSync('GenericRelation', relations),
                database.batchSync('Generic', generics),
                database.batchSync('PublicStaff', publicStuff)
            ]);
        });

        // let data = relations.concat(generics).concat(publicStuff);
        // database.batchSync(data, (syncErr) => {
        //     if (syncErr) {
        //         throw syncErr;
        //     }

        //     database.count(function(err3, total) {
        //         if (err3) {
        //             throw err3;
        //         }
        //         if (!total) {
        //             throw 'No tests fixtures has been inserted. Is the database connected ?';
        //         }
        //         done();
        //     });

        // });

    },


    userDocuments: function(server) {
        return Promise.resolve().then(() => {
            var database = server.plugins.eureka.database;

            var users = _.range(5).map((i) => {
                return {
                    _id: `user${i}`,
                    _type: 'User',
                    login: `user${i}`,
                    email: `user${i}@test.com`,
                    password: Bcrypt.hashSync(`secret${i}`, 10)
                };
            });

            users.push({
                _id: 'userwithscope',
                _type: 'User',
                login: 'userwithscope',
                email: 'userwithscope@test.com',
                password: Bcrypt.hashSync(`secret`, 10),
                scope: ['user-stuff-access']
            });

            users.push({
                _id: 'admin',
                _type: 'User',
                login: 'admin',
                email: 'admin@test.com',
                password: Bcrypt.hashSync(`adminsecret`, 10),
                scope: ['admin']
            });


            var scopes = {
                0: ['secret-keeper'],
                1: ['secret-keeper', 'other-secret'],
                2: ['new-guy'],
                3: ['other-secret'],
                4: ['admin']
            };

            var userStuff = _.range(10).map((i) => {
                return {
                    _id: `userstaff${i}`,
                    _type: 'UserStaff',
                    _owner: {_id: `user${i % 5}`, _type: 'User'},
                    _scope: scopes[i % 5],
                    title: `the secret thing of user ${i % 5}`,
                    isSecret: Boolean(i % 5)
                };
            });
            return Promise.all([
                database.User.batchSync(users),
                database.UserStaff.batchSync(userStuff)
            ]);
        });
    }
};

export default fixtures;

// if (require.main === module) {
//     /** load the server **/
//     eureka(config).compose(function(err, server) {
//         if (err) {
//             throw err;
//         }

//         fixtures.clear(server).then(() => {
//             return fixtures.genericDocuments(server);
//         }).then(() => {
//             return fixtures.userDocuments(server);
//         }).catch((error) => {
//             console.log(error);
//         });

//     });

// }
