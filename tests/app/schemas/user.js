
module.exports = {
    properties: {
        login: {
            type: 'string'
        },
        email: {
            type: 'string',
            validate: ['email']
        },
        emailVerified: {
            type: 'boolean'
        },
        password: {
            type: 'string'
        },
        passwordResetToken: {
            type: 'string'
        },
        scope: {
            type: 'string',
            multi: true
        }
    }
};