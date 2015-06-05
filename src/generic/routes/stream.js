
export default {
    _generic: true,
    path: '/i/stream/:format',
    method: 'get',
    policies: [],
    action: function(req, res) {
        return res.sendResults(`stream at ${req.params.format}`);
    }
};