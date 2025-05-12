const mongoose = require('mongoose');

const jokeSchema = new mongoose.Schema({
  email: { type: String, required: true },
  joke: { type: String, required: true },
  status: { type: String, default: 'pending' }
});

module.exports = mongoose.model('Joke', jokeSchema);