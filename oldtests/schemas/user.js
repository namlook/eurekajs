
module.exports = {
    properties: {
        login: {
            type: 'string'
        },
        email: {
            type: 'email'
        },
        password: {
            type: 'password'
        },
        groups: {
            type: 'string',
            multi: true
        }
    }
};