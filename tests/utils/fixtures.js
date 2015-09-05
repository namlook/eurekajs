
import Bcrypt from 'bcrypt';

export default {

    clear: function(server) {
        var database = server.plugins.eureka.database;

        return database.clear();
    },

    genericDocuments: function(server) {
        var database = server.plugins.eureka.database;

        var relations = [
            {
                _id: 'relation0',
                _type: 'GenericRelation',
                text: 'relation 0'
            },
            {
                _id: 'relation1',
                _type: 'GenericRelation',
                text: 'relation 1'
            }
        ];

        // relations = relations.map(function(pojo) {
        //     return database.GenericRelation.wrap(pojo).attrs();
        // });

        // console.dir(relations, {depth: 10});


        var generics = [];
        for (let i = 1; i < 11; i++) {
            generics.push({
                _id: `generic${i}`,
                _type: 'Generic',
                text: `hello world ${i}`,
                boolean: i % 2,
                integer: i,
                float: i + 0.14,
                date: new Date(1984, 7, i),
                relation: {_id: relations[i % 2]._id, _type: 'GenericRelation'}
            });
        }

        // generics = generics.map(function(pojo) {
        //     return new database.Generic(pojo).toSerializableObject();
        // });

        var publicStuff = [];
        for (let i = 0; i < 10; i++) {
            publicStuff.push({
                _id: `publicstuff${i}`,
                _type: 'PublicStuff',
                title: `public hello ${i}`
            });
        }

        // publicStuff = publicStuff.map(function(pojo) {
        //     return new database.PublicStuff(pojo).toSerializableObject();
        // });

        return Promise.all([
            database.batchSync('GenericRelation', relations),
            database.batchSync('Generic', generics),
            database.batchSync('PublicStuff', publicStuff)
        ]);

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
        var database = server.plugins.eureka.database;

        var users = [];
        for (let i = 0; i < 5; i++) {
            users.push({
                _id: `user${i}`,
                _type: 'User',
                login: `user${i}`,
                email: `user${i}@test.com`,
                password: Bcrypt.hashSync(`secret${i}`, 10)
            });
        }

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

        var userStuff = [];
        for (let i = 0; i < 10; i++) {
            userStuff.push({
                _id: `userstuff${i}`,
                _type: 'UserStuff',
                _owner: {_id: `user${i % 5}`, _type: 'User'},
                _scope: scopes[i % 5],
                title: `the secret thing of user ${i % 5}`,
                isSecret: Boolean(i % 5)
            });
        }

        return Promise.all([
            database.User.batchSync(users),
            database.UserStuff.batchSync(userStuff)
        ]);
    }
};
