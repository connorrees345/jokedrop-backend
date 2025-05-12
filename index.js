const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const multer = require('multer');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage: storage });

// MongoDB URI (replace with your own)
const mongoURI = "your_mongo_connection_string";
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// Define Mongoose models

// User Model
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
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const User = mongoose.model('User', userSchema);

// Joke Model
const jokeSchema = new mongoose.Schema({
  email: { type: String, required: true },
  joke: { type: String, required: true },
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Joke = mongoose.model('Joke', jokeSchema);

// Register User
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({
    email,
    password: hashedPassword,
  });

  await newUser.save();
  res.json({ success: true });
});

// Login User
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ email: user.email, id: user._id }, 'your_secret_key');
  res.json({ success: true, token });
});

// Get Profile
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

// Update Profile
app.post('/profile', upload.single('profilePicture'), async (req, res) => {
  const { email, name, location, dob, privacy } = req.body;
  const profilePicture = req.file ? req.file.path : undefined;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.name = name || user.name;
  user.location = location || user.location;
  user.dob = dob || user.dob;
  user.profilePicture = profilePicture || user.profilePicture;
  user.privacy = {
    name: privacy?.name ?? user.privacy.name,
    location: privacy?.location ?? user.privacy.location,
    dob: privacy?.dob ?? user.privacy.dob
  };

  await user.save();
  res.json({ success: true });
});

// Submit Joke
app.post('/submit', async (req, res) => {
  const { email, joke } = req.body;

  if (!email || !joke) {
    return res.status(400).json({ error: 'Email and joke are required' });
  }

  const newJoke = new Joke({
    email,
    joke,
    status: 'pending'
  });

  await newJoke.save();
  res.json({ success: true });
});

// Get Jokes (by user)
app.get('/jokes', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  const jokes = await Joke.find({ email });

  res.json({ success: true, jokes });
});

// Follow/Unfollow Users
app.post('/follow', async (req, res) => {
  const { follower, target } = req.body;

  if (!follower || !target) {
    return res.status(400).json({ error: 'Follower and target are required' });
  }

  const user = await User.findOne({ email: follower });
  const targetUser = await User.findOne({ email: target });

  if (!user || !targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.following.includes(targetUser._id)) {
    user.following.pull(targetUser._id);
    targetUser.followers.pull(user._id);
  } else {
    user.following.push(targetUser._id);
    targetUser.followers.push(user._id);
  }

  await user.save();
  await targetUser.save();

  res.json({ success: true });
});

// Get Trending Jokes
app.get('/trending', async (req, res) => {
  const jokes = await Joke.find({ status: 'approved' }).sort({ createdAt: -1 }).limit(5);
  res.json({ success: true, jokes });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});