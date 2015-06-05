
export default {
    _generic: true,
    path: '/i/group-by/:property',
    method: 'get',
    policies: [],
    action: function(req, res) {
        return res.sendResults(`group by ${req.params.property}`);
    }
};