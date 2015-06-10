
export default function(server, done) {
    server.database.clear(function(err) {
        if (err) {
            throw err;
        }

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

        var generics = [];
        for (var i = 1; i < 11; i++) {
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

        relations = relations.map(function(pojo) {
            return new server.database.GenericRelation(pojo).toSerializableObject();
        });

        generics = generics.map(function(pojo) {
            return new server.database.Generic(pojo).toSerializableObject();
        });


        server.database.batchSync(relations, function(err1) {
            if (err1) {
                throw err1;
            }
            server.database.batchSync(generics, function(err2) {
                if (err2) {
                    throw err2;
                }
                server.database.count(function(err3, total) {
                    if (err3) {
                        throw err3;
                    }
                    if (!total) {
                        throw 'No tests fixtures has been inserted. Is the database connected ?';
                    }
                    done();
                });
            });
        });
    });
}
