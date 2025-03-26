//---------------------------------------------SESSION TIME OUT----------------------------------------------------------

const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send({ message: 'No token provided.' });

    jwt.verify(token, 'your-secret-key', (err, decoded) => {
        if (err) return res.status(401).send({ message: 'Failed to authenticate token.' });
        req.userId = decoded.id;
        next();
    });
};

app.get('/api/auth/check-session', verifyToken, (req, res) => {
    res.status(200).send({ message: 'Session active' });
});
