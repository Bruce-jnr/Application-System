const path = require('path');

function isAdmittedStudent(req, res, next) {
    if (req.session && req.session.isStudent && req.session.studentId) {
        next();
    } else {
        res.redirect('/student/login');
    }
}

module.exports = { isAdmittedStudent };
