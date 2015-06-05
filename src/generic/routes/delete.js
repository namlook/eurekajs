
export default {
    _generic: true,
    path: '/:id',
    method: 'delete',
    policies: [],
    action: function(req, res) {
        return res.sendResults('ok');
    }
};