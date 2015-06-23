
import Bcrypt from 'bcrypt';

export default {

    clear: function(server, done) {
        var database = server.plugins.eureka.database;

        database.clear(function(err) {
            if (err) {
                throw err;
            }

            done();
        });
    },

    genericDocuments: function(server, done) {
        var database = server.plugins.eureka.database;

        var relations = [
            {
                _id: 'relation0',
                _type: 'GenericRelation',
                text: 'relation 0',
                arf: 'bla'
            },
            {
                _id: 'relation1',
                _type: 'GenericRelation',
                text: 'relation 1',
                arf: 'ble'
            }
        ];

        relations = relations.map(function(pojo) {
            return new database.GenericRelation(pojo).toSerializableObject();
        });


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

        generics = generics.map(function(pojo) {
            return new database.Generic(pojo).toSerializableObject();
        });


        let data = relations.concat(generics);
        database.batchSync(data, (syncErr) => {
            if (syncErr) {
                throw syncErr;
            }

            database.count(function(err3, total) {
                if (err3) {
                    throw err3;
                }
                if (!total) {
                    throw 'No tests fixtures has been inserted. Is the database connected ?';
                }
                done();
            });

        });

    },


    userDocuments: function(server, done) {
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
        users = users.map(function(pojo) {
            return new database.User(pojo).toSerializableObject();
        });


        var userStuff = [];
        for (let i = 0; i < 10; i++) {
            userStuff.push({
                _id: `userstuff${i}`,
                _owner: `user${i % 5}`,
                title: `the secret thing of user ${i % 5}`,
                isSecret: Boolean(i % 5)
            });
        }
        userStuff = userStuff.map(function(pojo) {
            return new database.UserStuff(pojo).toSerializableObject();
        });


        let data = users.concat(userStuff);

        database.batchSync(data, (syncErr) => {
            if (syncErr) {
                throw syncErr;
            }

            database.count(function(err3, total) {
                if (err3) {
                    throw err3;
                }
                if (!total) {
                    throw 'No tests fixtures has been inserted. Is the database connected ?';
                }
                done();
            });

        });
    }
};