// index.js (Updated backend using MongoDB + Mongoose)

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(
  'mongodb+srv://jokedrop:connorrees@jokedrop-cluster.4zcbnju.mongodb.net/?retryWrites=true&w=majority&appName=jokedrop-cluster',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
).then(() => console.log('MongoDB connected'))
 .catch(err => console.error('MongoDB connection error:', err));

// Define User schema and model
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String,
  location: String,
  dob: String,
  profilePicture: String,
  privacy: {
    name: Boolean,
    location: Boolean,
    dob: Boolean
  },
  followers: [String],
  following: [String],
  role: { type: String, default: 'user' }
});
const User = mongoose.model('User', userSchema);

// Define Joke schema and model
const jokeSchema = new mongoose.Schema({
  email: String,
  joke: String,
  status: { type: String, default: 'pending' },
  timestamp: { type: Date, default: Date.now }
});
const Joke = mongoose.model('Joke', jokeSchema);

// Register
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ success: false, error: 'User already exists' });

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({
    email,
    password: hashed,
    name: '',
    location: '',
    dob: '',
    profilePicture: '',
    privacy: { name: true, location: true, dob: false },
    followers: [],
    following: []
  });
  await user.save();
  res.json({ success: true });
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  res.json({ success: true });
});

// Submit Joke
app.post('/submit', async (req, res) => {
  const { email, joke } = req.body;
  if (!email || !joke) return res.status(400).json({ success: false, error: 'Email and joke are required' });

  const newJoke = new Joke({ email, joke });
  await newJoke.save();
  res.json({ success: true });
});

// Get jokes for a user
app.get('/jokes', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });

  const jokes = await Joke.find({
    email,
    status: { $in: ['approved', 'pending'] }
  });
  res.json({ success: true, jokes });
});

// Get Profile
app.get('/profile', async (req, res) => {
  const { email } = req.query;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const { name, location, dob, profilePicture, privacy, followers, following } = user;
  res.json({ success: true, name, location, dob, profilePicture, privacy, followers, following });
});

// Update Profile
app.post('/profile', async (req, res) => {
  const { email, name, location, dob, profilePicture, privacy } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  user.name = name || '';
  user.location = location || '';
  user.dob = dob || '';
  user.profilePicture = profilePicture || '';
  user.privacy = {
    name: privacy?.name ?? true,
    location: privacy?.location ?? true,
    dob: privacy?.dob ?? false
  };
  await user.save();
  res.json({ success: true });
});

// Change Password
app.post('/change-password', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(401).json({ success: false, error: 'Incorrect current password' });
  }
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ success: true });
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));