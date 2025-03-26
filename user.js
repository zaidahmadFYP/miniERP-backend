

// --------------------------------- User Authentication ---------------------------------

const userSchema = new mongoose.Schema({
    name: String,
    displayName: String,
    username: {
      type: String,
      required: true,
      unique: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: String, // Hashed password
    plainPassword: String, // New field for storing plain password
    role: String,
    zone: String,
    branch: String,
    registeredModules: Array
  });
  
  const User = mongoose.model('User', userSchema);
  
  // Create a new user (for testing purposes or dynamic user creation)
  const bcrypt = require('bcrypt');
  
  app.post('/api/users', async (req, res) => {
    try {
      const { firstName, lastName, displayName, username, password, role, zone, branch, modules } = req.body;
  
      if (!firstName || !lastName || !displayName || !username || !password || !role || !zone || !branch) {
        return res.status(400).json({ message: 'All fields are required' });
      }
  
      const email = `${username}@cheezious.com`;
  
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ message: 'Email already exists' });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const newUser = new User({
        name: `${firstName} ${lastName}`,
        displayName,
        username,
        email,
        password: hashedPassword,
        plainPassword: password, // Save the plain password
        role,
        zone,
        branch,
        registeredModules: modules
      });
  
      await newUser.save();
  
      res.status(201).json({ message: 'User created successfully', user: newUser });
    } catch (error) {
      console.error('Error creating user:', error.stack);
      res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
  });
  
  
  app.post('/api/auth/signin', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
  
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Ensure both data and hash are present for bcrypt.compare()
      if (!user.password) {
        console.error('Password not found for user:', email);
        return res.status(500).json({ message: 'Server error: Missing password data' });
      }
  
      // Compare plain-text password with hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
  
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
  
      // Return user data (excluding password)
      res.status(200).json({
        name: user.name,
        email: user.email,
        branch: user.branch,
        role: user.role,
        zone: user.zone,
        registeredModules: user.registeredModules,
      });
    } catch (error) {
      console.error('Error during sign-in:', error.message, error.stack);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  
  app.get('/api/users', async (req, res) => {
    try {
      const users = await User.find(); // Fetch all users
      res.status(200).json(users); // Include plainPassword in the response
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  app.put('/api/users/:id', async (req, res) => {
    try {
      const { name, displayName, username, branch, role, password, zone } = req.body; // Add zone
  
      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { name, displayName, username, branch, role, password, zone }, // Include zone in the update
        { new: true }
      );
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.status(200).json(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Update user's modules
  app.put('/api/users/:id', async (req, res) => {
    const { id: userId } = req.params;
    const { name, displayName, role, branch, zone } = req.body;
  
    console.log("Received updateDetails request:", req.body); // Log the entire request payload
  
    // Validate userId as a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error("Invalid User ID:", userId);
      return res.status(400).json({ message: 'Invalid User ID' });
    }
  
    // Check for missing fields and log each field for debugging
    if (!name || !displayName || !role || !branch || !zone) {
      console.error("Missing required fields in request body:", {
        name,
        displayName,
        role,
        branch,
        zone
      });
      return res.status(400).json({ message: 'All fields are required' });
    }
  
    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { name, displayName, role, branch, zone },
        { new: true, runValidators: true, strict: true }
      );
  
      if (!updatedUser) {
        console.error("User not found for ID:", userId);
        return res.status(404).json({ message: 'User not found' });
      }
  
      res.status(200).json({ message: 'User details updated successfully', updatedUser });
    } catch (error) {
      if (error.name === 'ValidationError') {
        console.error('Validation Error during user update:', error.errors);
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else if (error.name === 'CastError') {
        console.error('Cast Error during user update:', error);
        return res.status(400).json({ message: 'Invalid data type for one or more fields', error: error.message });
      } else {
        console.error('Error during user update:', error.stack || error);
        return res.status(500).json({ message: 'Server error', error: error.message });
      }
    }
  });
  
  // Update user's modules
  app.put('/api/users/:id/modules', async (req, res) => {
    console.log(`Request received to update modules for user: ${req.params.id}`);
    
    try {
      const { modules } = req.body;
      const userId = req.params.id;
  
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.log('Invalid User ID:', userId);
        return res.status(400).send({ message: 'Invalid User ID' });
      }
  
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { registeredModules: modules },
        { new: true, runValidators: true }
      );
  
      if (!updatedUser) {
        console.log('User not found:', userId);
        return res.status(404).send({ message: 'User not found' });
      }
  
      res.status(200).send({ message: 'Modules updated successfully', updatedUser });
    } catch (error) {
      console.error('Error updating modules:', error);
      res.status(500).send({ message: 'Internal server error' });
    }
  });
  
  app.delete('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
  
      // Log the ID received
      console.log(`Received request to delete user with ID: ${id}`);
  
      // Ensure the ID is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        console.log('Invalid user ID');
        return res.status(400).json({ message: 'Invalid user ID', status: 'error' });
      }
  
      // Find and delete the user
      const deletedUser = await User.findByIdAndDelete(id);
  
      if (!deletedUser) {
        console.log('User not found');
        return res.status(404).json({ message: 'User not found', status: 'error' });
      }
  
      console.log('User deleted successfully');
      return res.status(200).json({ message: 'User deleted successfully', status: 'success' });
    } catch (error) {
      console.error('Error deleting user:', error);
      return res.status(500).json({ message: 'Internal server error', status: 'error' });
    }
  });
  
  app.put('/api/users/:id/resetPassword', async (req, res) => {
    try {
      const { newPassword } = req.body;
  
      if (!newPassword) {
        return res.status(400).json({ message: 'New password is required' });
      }
  
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
  
      // Update both hashed and plain passwords in the database
      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { password: hashedPassword, plainPassword: newPassword },
        { new: true }
      );
  
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      res.status(200).json({ message: 'Password reset successfully', user: updatedUser });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  
  // Endpoint to add multiple users
  app.post('/api/users/multiple', async (req, res) => {
    try {
      const { users } = req.body;
  
      if (!users || !Array.isArray(users)) {
        return res.status(400).json({ message: 'Invalid user data' });
      }
  
      // Validate each user to ensure required fields are present
      for (const user of users) {
        if (!user.username || !user.email || !user.password || !user.role || !user.zone || !user.branch) {
          return res.status(400).json({ message: 'Missing required fields for one or more users' });
        }
      }
  
      // Check if any user already exists by email
      const existingEmails = await User.find({ email: { $in: users.map((user) => user.email) } }).select('email');
      if (existingEmails.length > 0) {
        const existingEmailsList = existingEmails.map((user) => user.email);
        return res.status(409).json({ message: 'Some emails already exist', existingEmails: existingEmailsList });
      }
  
      // Hash passwords and prepare users for saving
      const usersToInsert = await Promise.all(users.map(async (user) => {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        return { ...user, password: hashedPassword };
      }));
  
      // Insert all users into the database
      await User.insertMany(usersToInsert);
      res.status(201).json({ message: 'Users added successfully' });
    } catch (error) {
      console.error('Error adding users:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  //----------------------------------------------------------------------------------------------------------------