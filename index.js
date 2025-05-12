const express = require('express');
const fs = require('fs');
const bcrypt = require('bcrypt');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const USERS_FILE = 'users.json';
const JOKES_FILE = 'jokes.json';

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE));
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function getAllJokes() {
  if (!fs.existsSync(JOKES_FILE)) return [];
  return JSON.parse(fs.readFileSync(JOKES_FILE));
}
function saveJokes(jokes) {
  fs.writeFileSync(JOKES_FILE, JSON.stringify(jokes, null, 2));
}

app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ success: false, error: 'User already exists' });
  }
  const hashed = await bcrypt.hash(password, 10);
  users.push({
    email,
    password: hashed,
    name: "", location: "", dob: "", profilePicture: "",
    privacy: { name: true, location: true, dob: false },
    followers: [], following: []
  });
  saveUsers(users);
  res.json({ success: true });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  res.json({ success: true });
});

app.post('/submit', (req, res) => {
  const { email, joke } = req.body;
  if (!email || !joke) return res.status(400).json({ success: false, error: 'Missing fields' });
  const jokes = getAllJokes();
  jokes.push({ email, joke, status: 'pending' });
  saveJokes(jokes);
  res.json({ success: true });
});

app.get('/jokes', (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });
  const jokes = getAllJokes();
  const userJokes = jokes.filter(j => j.email === email && (j.status === 'approved' || j.status === 'pending'));
  res.json({ success: true, jokes: userJokes });
});

app.get('/profile', (req, res) => {
  const { email } = req.query;
  const users = loadUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const { name, location, dob, profilePicture, privacy, followers, following } = user;
  res.json({ success: true, name, location, dob, profilePicture, privacy, followers, following });
});

app.post('/profile', (req, res) => {
  const { email, name, location, dob, profilePicture, privacy } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  user.name = name || "";
  user.location = location || "";
  user.dob = dob || "";
  user.profilePicture = profilePicture || "";
  user.privacy = {
    name: privacy?.name ?? true,
    location: privacy?.location ?? true,
    dob: privacy?.dob ?? false
  };
  saveUsers(users);
  res.json({ success: true });
});

app.post('/change-password', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) return res.status(401).json({ success: false, error: 'Incorrect password' });
  const hashed = await bcrypt.hash(newPassword, 10);
  user.password = hashed;
  saveUsers(users);
  res.json({ success: true });
});

app.post('/follow', (req, res) => {
  const { follower, target } = req.body;
  const users = loadUsers();
  const u1 = users.find(u => u.email === follower);
  const u2 = users.find(u => u.email === target);
  if (!u1 || !u2) return res.status(404).json({ success: false, error: 'User not found' });
  if (!u1.following.includes(target)) u1.following.push(target);
  if (!u2.followers.includes(follower)) u2.followers.push(follower);
  saveUsers(users);
  res.json({ success: true });
});

app.get('/users/suggestions', (req, res) => {
  const { email } = req.query;
  const users = loadUsers();
  const me = users.find(u => u.email === email);
  if (!me) return res.status(404).json({ success: false, error: 'User not found' });
  const suggestions = users.filter(u => u.email !== email && !me.following.includes(u.email)).map(u => ({
    email: u.email, name: u.name
  }));
  res.json({ success: true, users: suggestions.slice(0, 5) });
});

app.get('/trending', (req, res) => {
  const jokes = getAllJokes();
  const approved = jokes.filter(j => j.status === 'approved');
  const users = loadUsers();
  const trending = approved.slice(-10).reverse().map(j => {
    const author = users.find(u => u.email === j.email);
    return { ...j, name: author?.name || j.email };
  });
  res.json({ success: true, jokes: trending });
});

app.listen(PORT, () => {
  console.log(`✅ Joke Drop backend running on port ${PORT}`);
});