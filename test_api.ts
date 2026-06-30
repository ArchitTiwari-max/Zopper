import jwt from 'jsonwebtoken';

const JWT_SECRET = 'zopvish12';

const payload = {
  userId: 'user_00009', // Sonal's user ID
  email: 'sonal@example.com',
  username: 'sonal123',
  role: 'EXECUTIVE'
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });

fetch('http://localhost:3000/api/executive/subordinate-visits?range=last_30&page=1', {
  headers: {
    'Cookie': `accessToken=${token}`
  }
})
.then(res => res.json())
.then(data => console.log('SONAL:', JSON.stringify(data, null, 2)))
.catch(console.error);

const payload2 = {
  userId: 'user_00008', // Neeraj's user ID is user_00008 ? Let's check DB later. Let's just run it!
  email: 'neeraj@example.com',
  username: 'neeraj123',
  role: 'EXECUTIVE'
};
