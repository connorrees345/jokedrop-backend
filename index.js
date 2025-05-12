const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer setup for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage: storage });

// MongoDB URI (using MongoDB Atlas connection string)
const mongoURI = "mongodb+srv://jokedrop:connorrees@cluster0.mongodb.net/jokedrop?retryWrites=true&w=majority";
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// Define Models (User, Joke)
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String, default: "" },
  location: { type: String, default: "" },
  dob: { type: String, default: "" },
  profilePicture: { type: String, default: "" },
  privacy: {
    name: { type: Boolean, default: true },
    location: { type: Boolean, default: true },
    dob: { type: Boolean, default: false },
  },
});

const User = mongoose.model('User', userSchema);

const jokeSchema = new mongoose.Schema({
  email: { type: String, required: true },
  joke: { type: String, required: true },
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Joke = mongoose.model('Joke', jokeSchema);

// Test password: "connorrees" (for testing only)

// User Registration Route
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ email, password: hashedPassword });

  await newUser.save();
  res.json({ success: true });
});

// Login Route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ email: user.email, id: user._id }, 'your_secret_key');
  res.json({ success: true, token });
});

// Profile Route
app.get('/profile', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    success: true,
    profile: {
      name: user.name,
      location: user.location,
      dob: user.dob,
      profilePicture: user.profilePicture,
      privacy: user.privacy
    }
  });
});

// Update Profile Route
app.post('/profile', async (req, res) => {
  const { email, name, location, dob, profilePicture, privacy } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

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

// Submit Joke Route
app.post('/submit', async (req, res) => {
  const { email, joke } = req.body;

  if (!email || !joke) {
    return res.status(400).json({ error: 'Email and joke are required' });
  }

  const newJoke = new Joke({ email, joke, status: 'pending' });
  await newJoke.save();
  res.json({ success: true });
});

// Get All Jokes (by user)
app.get('/jokes', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  const jokes = await Joke.find({ email });

  res.json({ success: true, jokes });
});

// Admin Routes for Approving Jokes (for moderation)
app.post('/approve-joke', async (req, res) => {
  const { jokeId } = req.body;
  const joke = await Joke.findById(jokeId);

  if (!joke) {
    return res.status(404).json({ error: 'Joke not found' });
  }

  joke.status = 'approved';
  await joke.save();

  res.json({ success: true });
});

// Admin Routes for Rejecting Jokes
app.post('/reject-joke', async (req, res) => {
  const { jokeId } = req.body;
  const joke = await Joke.findById(jokeId);

  if (!joke) {
    return res.status(404).json({ error: 'Joke not found' });
  }

  joke.status = 'rejected';
  await joke.save();

  res.json({ success: true });
});

// Follow System Routes (Follow/Unfollow Users)
app.post('/follow', async (req, res) => {
  const { follower, target } = req.body;

  const user = await User.findOne({ email: follower });
  const targetUser = await User.findOne({ email: target });

  if (!user || !targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Add to followers and following list
  if (!user.following.includes(target)) {
    user.following.push(target);
    targetUser.followers.push(follower);
    await user.save();
    await targetUser.save();
    res.json({ success: true });
  } else {
    return res.status(400).json({ error: 'Already following' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});