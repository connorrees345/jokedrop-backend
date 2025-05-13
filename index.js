const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;
require('dotenv').config(); // Ensure .env is loaded to access MONGO_URI

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log('MongoDB connection error:', err));

// MongoDB schemas
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
  following: [String]
});

const jokeSchema = new mongoose.Schema({
  email: String,
  joke: String,
  status: { type: String, default: 'pending' }
});

const User = mongoose.model('User', userSchema);
const Joke = mongoose.model('Joke', jokeSchema);

// Route: Register
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ success: false, error: 'User already exists' });
  }

  // Hash password before storing it
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create new user
  const newUser = new User({
    email,
    password: hashedPassword,
    name: "",
    location: "",
    dob: "",
    profilePicture: "",
    privacy: { name: true, location: true, dob: false },
    followers: [],
    following: []
  });

  await newUser.save();
  res.json({ success: true });
});

// Route: Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Find the user
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

  // Compare the password
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ success: false, error: 'Invalid credentials' });

  res.json({ success: true });
});

// Route: Submit Joke
app.post('/submit', async (req, res) => {
  const { email, joke } = req.body;

  if (!email || !joke) {
    return res.status(400).json({ success: false, error: 'Email and joke are required' });
  }

  const newJoke = new Joke({
    email,
    joke,
    status: 'pending'
  });

  await newJoke.save();
  res.json({ success: true });
});

// Route: Get Jokes
app.get('/jokes', async (req, res) => {
  const email = req.query.email;

  if (!email) return res.status(400).json({ success: false, error: 'Email required' });

  const jokes = await Joke.find({ email, status: { $in: ['pending', 'approved'] } });
  res.json({ success: true, jokes });
});

// Route: Get User Profile
app.get('/profile', async (req, res) => {
  const email = req.query.email;

  if (!email) return res.status(400).json({ success: false, error: 'Email required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const { name, location, dob, profilePicture, privacy } = user;
  res.json({ success: true, name, location, dob, profilePicture, privacy });
});

// Route: Update User Profile
app.post('/profile', async (req, res) => {
  const { email, name, location, dob, profilePicture, privacy } = req.body;

  if (!email) return res.status(400).json({ success: false, error: 'Email required' });

  const user = await User.findOne({ email });
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

  await user.save();
  res.json({ success: true });
});

// Route: Change Password
app.post('/change-password', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  if (!email || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'All fields required' });
  }

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) return res.status(401).json({ success: false, error: 'Incorrect current password' });

  const hashed = await bcrypt.hash(newPassword, 10);
  user.password = hashed;
  await user.save();

  res.json({ success: true });
});

// Route: Follow User
app.post('/follow', async (req, res) => {
  const { follower, target } = req.body;

  if (!follower || !target) return res.status(400).json({ success: false, error: 'Both follower and target required' });

  const followerUser = await User.findOne({ email: follower });
  const targetUser = await User.findOne({ email: target });

  if (!followerUser || !targetUser) return res.status(404).json({ success: false, error: 'User not found' });

  // Add target to follower's following list and vice versa
  if (!followerUser.following.includes(target)) {
    followerUser.following.push(target);
    await followerUser.save();
  }

  if (!targetUser.followers.includes(follower)) {
    targetUser.followers.push(follower);
    await targetUser.save();
  }

  res.json({ success: true });
});

// Route: Get Suggested Users to Follow
app.get('/users/suggestions', async (req, res) => {
  const email = req.query.email;

  if (!email) return res.status(400).json({ success: false, error: 'Email required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  // Find users that the logged-in user isn't already following
  const suggestedUsers = await User.find({ email: { $ne: email } });
  const filteredSuggestions = suggestedUsers.filter(u => !user.following.includes(u.email));

  res.json({ success: true, users: filteredSuggestions });
});

// Route: Moderator Approve Joke
app.post('/approve-joke', async (req, res) => {
  const { jokeId } = req.body;

  const joke = await Joke.findById(jokeId);
  if (!joke) return res.status(404).json({ success: false, error: 'Joke not found' });

  joke.status = 'approved';
  await joke.save();

  res.json({ success: true });
});

// Route: Moderator Reject Joke
app.post('/reject-joke', async (req, res) => {
  const { jokeId } = req.body;

  const joke = await Joke.findById(jokeId);
  if (!joke) return res.status(404).json({ success: false, error: 'Joke not found' });

  joke.status = 'rejected';
  await joke.save();

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`✅ Joke Drop backend running on port ${PORT}`);
});
