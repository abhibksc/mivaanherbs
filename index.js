const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const authRoutes = require('./routes/auth');
const activate_router=require('./routes/activate');

app.use('/api', authRoutes);
app.use('/api', activate_router);

mongoose.connect("mongodb://localhost:27017/MLMauth_db", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('MongoDB connected');
  app.listen(3000, () => {
    console.log(`Server running at http://localhost:${3000}`);
  });
})
.catch(err => {
  console.error('Mongo connection error:', err);
});
