
export default {
    _generic: true,
    path: '/:id',
    method: 'post',
    policies: [],
    action: function(req, res) {
        return res.sendResults('ok');
    }
};