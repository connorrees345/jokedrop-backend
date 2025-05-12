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

// Register
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
    name: "",
    location: "",
    dob: "",
    profilePicture: "",
    privacy: { name: true, location: true, dob: false },
    followers: [],
    following: []
  });

  saveUsers(users);
  res.json({ success: true });
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.email === email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  res.json({ success: true });
});

// Submit Joke
app.post('/submit', (req, res) => {
  const { email, joke } = req.body;
  if (!email || !joke) {
    return res.status(400).json({ success: false, error: 'Email and joke are required' });
  }

  const jokes = getAllJokes();
  jokes.push({ email, joke, status: 'pending' });
  saveJokes(jokes);

  res.json({ success: true });
});

// Get jokes for user
app.get('/jokes', (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });

  const jokes = getAllJokes();
  const userJokes = jokes.filter(j =>
    j.email === email && (j.status === 'pending' || j.status === 'approved')
  );

  res.json({ success: true, jokes: userJokes });
});

// Get trending jokes
app.get('/trending', (req, res) => {
  const jokes = getAllJokes().filter(j => j.status === 'approved');
  const users = loadUsers();
  const trending = jokes.slice(-10).reverse().map(joke => {
    const user = users.find(u => u.email === joke.email);
    return {
      joke: joke.joke,
      name: user?.privacy?.name && user?.name ? user.name : user?.email || 'Unknown'
    };
  });

  res.json({ success: true, jokes: trending });
});

// Get profile
app.get('/profile', (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });

  const users = loadUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const { name, location, dob, profilePicture, privacy, followers, following } = user;
  res.json({ success: true, name, location, dob, profilePicture, privacy, followers, following });
});

// Update profile
app.post('/profile/update', (req, res) => {
  const { email, name, location, dob, profilePicture, privacy } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

  const users = loadUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  user.name = name || user.name || "";
  user.location = location || user.location || "";
  user.dob = dob || user.dob || "";
  user.profilePicture = profilePicture || user.profilePicture || "";
  user.privacy = {
    name: privacy?.name ?? user.privacy?.name ?? true,
    location: privacy?.location ?? user.privacy?.location ?? true,
    dob: privacy?.dob ?? user.privacy?.dob ?? false
  };

  saveUsers(users);
  res.json({ success: true });
});

// Change password
app.post('/change-password', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  if (!email || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'All fields required' });
  }

  const users = loadUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) return res.status(401).json({ success: false, error: 'Incorrect current password' });

  const hashed = await bcrypt.hash(newPassword, 10);
  user.password = hashed;
  saveUsers(users);

  res.json({ success: true });
});

// Follow a user
app.post('/follow', (req, res) => {
  const { follower, target } = req.body;
  if (!follower || !target || follower === target) {
    return res.status(400).json({ success: false, error: 'Invalid follow data' });
  }

  const users = loadUsers();
  const fromUser = users.find(u => u.email === follower);
  const toUser = users.find(u => u.email === target);

  if (!fromUser || !toUser) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  fromUser.following = fromUser.following || [];
  toUser.followers = toUser.followers || [];

  if (!fromUser.following.includes(target)) fromUser.following.push(target);
  if (!toUser.followers.includes(follower)) toUser.followers.push(follower);

  saveUsers(users);
  res.json({ success: true });
});

// Suggested users to follow
app.get('/users/suggestions', (req, res) => {
  const { email } = req.query;
  const users = loadUsers();
  const me = users.find(u => u.email === email);

  if (!me) return res.status(404).json({ success: false, error: 'User not found' });

  const following = new Set(me.following || []);
  const suggestions = users
    .filter(u => u.email !== email && !following.has(u.email))
    .map(u => ({
      email: u.email,
      name: u.privacy?.name && u.name ? u.name : ""
    }));

  res.json({ success: true, users: suggestions });
});

app.listen(PORT, () => {
  console.log(`✅ Joke Drop backend running on port ${PORT}`);
});