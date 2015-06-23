
module.exports = {
    properties: {
        login: {
            type: 'string'
        },
        email: {
            type: 'string',
            validate: ['email']
        },
        password: {
            type: 'string'
        },
        passwordResetToken: {
            type: 'string'
        },
        groups: {
            type: 'string',
            multi: true
        }
    }
};