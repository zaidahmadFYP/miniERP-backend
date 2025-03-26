require('dotenv').config();
console.log(process.env.MONGO_URI); 
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const cors = require('cors');
const { Readable } = require('stream');
const path = require('path');


// Initialize Express App
const app = express();
const PORT = process.env.PORT ;
//const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
mongoose.connect(process.env.MONGO_URI, {
}).then(() => {
  console.log('MongoDB connected successfully');
}).catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});
//mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mauwinapp');

// Connect to MongoDB
//mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });


const db = mongoose.connection;
let gridfsBucket;

// Handle MongoDB connection
db.once('open', async () => {
  console.log('MongoDB connected');
  gridfsBucket = new GridFSBucket(db.db, { bucketName: 'uploads' });
  console.log('GridFS initialized');

  await initializeZones();
});


// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


//---------------------------------ZONE AND BRANCHES--------------------------------------
// Define Zone schema
const zoneSchema = new mongoose.Schema({
  zoneName: { type: String, required: true }, // The name of the zone
  branches: { type: [String], default: [] },  // List of branches in this zone
});

// Create Zone model from the schema
const Zone = mongoose.model('Zone', zoneSchema);

// Function to initialize zones and branches in the database
const initializeZones = async () => {
  const initialZones = {
    'Zone A': ['Cheezious Headquarters', 'Cheezious I-8', 'Cheezious F-7/1', 'Cheezious F-7/2', 'Cheezious G-9'],
    'Zone B': ['Cheezious F-10', 'Cheezious F-11', 'Cheezious E-11', 'Cheezious WAH CANTT', 'Cheezious G-13', 'Cheezious GOLRA'],
    'Zone C': ['Cheezious SADDAR', 'Cheezious Commercial 1 & 2', 'Cheezious OLD WORKSHOP', 'Cheezious Support Center'],
    'Zone D': ['Cheezious GHAURI TOWN', 'Cheezious TRAMRI', 'Cheezious PWD', 'Cheezious SCHEME 3'],
    'Zone E': ['Cheezious ADYALA', 'Cheezious KALMA', 'Cheezious BAHRIA', 'Cheezious ZARAJ GT ROAD', 'Cheezious GIGA', 'Cheezious Warehouse HUMAK'],
    'Zone F': ['Cheezious PESHAWAR', 'Cheezious MARDAN'],
  };

  try {
    // Check if zones already exist
    const zoneCount = await Zone.countDocuments();
    
    if (zoneCount === 0) {
      // Insert the initial zones into the database
      const zonesToInsert = Object.keys(initialZones).map((zoneName) => ({
        zoneName,
        branches: initialZones[zoneName],
      }));
      
      await Zone.insertMany(zonesToInsert);
      console.log('Initial zones and branches added to MongoDB');
    } else {
      console.log('Zones already exist in MongoDB');
    }
  } catch (error) {
    console.error('Error initializing zones:', error);
  }
};

// API to get all zones and branches
app.get('/api/zones', async (req, res) => {
  try {
    const zones = await Zone.find(); // Fetch all zones
    res.status(200).json(zones);
  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/zones/:zoneName/branches', async (req, res) => {
  const zoneName = req.params.zoneName;
  try {
      const zone = await Zone.findOne({ zoneName });
      if (!zone) {
          return res.status(404).json({ message: 'Zone not found' });
      }
      res.status(200).json(zone.branches);
  } catch (error) {
      console.error('Error fetching branches:', error); // Log the error
      res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});


// API to add a branch to a specific zone
app.post('/api/zones/:zoneName/addBranch', async (req, res) => {
  try {
    const { zoneName } = req.params;
    const { branchName } = req.body;

    const zone = await Zone.findOne({ zoneName }); // Find the zone by name
    if (!zone) {
      return res.status(404).json({ message: 'Zone not found' });
    }

    // Add the new branch to the zone
    zone.branches.push(branchName);
    await zone.save();

    res.status(200).json({ message: `Branch ${branchName} added to zone ${zoneName}`, zone });
  } catch (error) {
    console.error('Error adding branch:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// API to update a branch name in a specific zone   
app.put('/api/zones/:zoneId/editBranch', async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { oldBranchName, newBranchName } = req.body;

    const zone = await Zone.findById(zoneId);
    console.log("Fetched Zone:", zone); // Log the zone object to inspect its structure

    if (!zone) {
      return res.status(404).json({ message: 'Zone not found' });
    }

    // Find the branch index and update the branch name
    const branchIndex = zone.branches.indexOf(oldBranchName);
    console.log("Branch Index:", branchIndex); // Log the branch index to see if it’s found

    if (branchIndex === -1) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    if (newBranchName) {
      // Edit the branch name
      zone.branches[branchIndex] = newBranchName;
    } else {
      // Remove the branch
      zone.branches.splice(branchIndex, 1);
    }

    await zone.save();

    res.status(200).json({ message: `Branch ${oldBranchName} updated successfully`, zone });
  } catch (error) {
    console.error('Error updating branch:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE API to delete a branch from a specific zone
app.delete('/api/zones/:zoneId/deleteBranch', async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { branchName } = req.body;

    // Find the zone by ID
    const zone = await Zone.findById(zoneId);

    if (!zone) {
      return res.status(404).json({ message: 'Zone not found' });
    }

    // Find the index of the branch to delete
    const branchIndex = zone.branches.indexOf(branchName);

    if (branchIndex === -1) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    // Remove the branch
    zone.branches.splice(branchIndex, 1);
    await zone.save();

    res.status(200).json({ message: `Branch ${branchName} removed successfully`, zone });
  } catch (error) {
    console.error('Error deleting branch:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

//----------------------------------------------------------------------------------------


// --------------------------------- User Authentication ---------------------------------

// const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');

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
  registeredModules: Array, // List of modules the user has access to
});

const User = mongoose.model('User', userSchema);


// Create a new user (for testing purposes or dynamic user creation)
const bcrypt = require('bcrypt');
app.post('/api/users', async (req, res) => {
  try {
    const { firstName, lastName, displayName, username, password, role, modules } = req.body;

    if (!firstName || !lastName || !displayName || !username || !password || !role || !modules) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const email = `${username}@loop.com`; // Updated email format

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
      registeredModules: modules,
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
      role: user.role,
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
    const { name, displayName, username, role, password, modules } = req.body;

    if (!name || !displayName || !role || !modules) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name, displayName, username, role, password, registeredModules: modules },
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

//Update Users Module's
app.put('/api/users/:id/modules', async (req, res) => {
  const { modules } = req.body;
  const userId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({ message: 'Invalid User ID' });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { registeredModules: modules },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).send({ message: 'User not found' });
    }

    res.status(200).send({ message: 'Modules updated successfully', updatedUser });
  } catch (error) {
    console.error('Error updating modules:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
});

//Delete User
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//Reset User's Password
app.put('/api/users/:id/resetPassword', async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

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

// Configure Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/png', //png
      'image/jpeg', //jpeg
      'image/webp', //webp
      'application/pdf', //pdf
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'text/csv', // .csv
      'application/txt' //txt
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true); // Accept the file
    } else {
      cb(new Error('Invalid file type! Only PNG, JPEG, WebP, PDF, DOCX, XLS, XLSX, and CSV files are allowed.'));
    }
  },
});

// Mongoose Schema to store file metadata, including category (directory)
const fileSchema = new mongoose.Schema({
  filename: String,
  filetype: String,
  lastModified: String,
  fileId: mongoose.Schema.Types.ObjectId,
  category: String,
  fileNumber: String,  // Store the file number here
  zone: String,        // New: Zone field
  branch: String,      // New: Branch field
});

const File = mongoose.model('File', fileSchema);

// Utility function to get the next file number in sequence for a specific category
const getNextFileNumber = async (category, zone, branch) => {
  const fileCount = await File.countDocuments({ category, zone, branch }); // Count only files within the same category, zone, and branch
  const nextNumber = (fileCount + 1).toString().padStart(5, '0'); // Start from '00001'
  return nextNumber;
};

// 1. Get all files for a specific category (READ)
app.get('/api/files/:category/:zone/:branch', async (req, res) => {
  try {
    const { category, zone, branch } = req.params;
    const files = await File.find({ category, zone, branch });

    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'No files found for this category, zone, and branch.' });
    }

    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 2. Upload a new file to GridFS under a specific category (CREATE)
app.post('/api/files/:category/:zone/:branch', upload.single('file'), async (req, res) => {
  try {
    const { category, zone, branch } = req.params;
    const originalFilename = req.file.originalname.trim();

    console.log('Original Filename:', originalFilename);

    // Create readable stream from the uploaded file buffer directly
    const readableStream = new Readable({
      read() {
        this.push(req.file.buffer);
        this.push(null);
      }
    });

    // Get file number more efficiently (e.g., using an atomic counter or cache)
    const fileNumber = await getNextFileNumber(category, zone, branch);

    // Upload the file to GridFS
    const uploadStream = gridfsBucket.openUploadStream(originalFilename, {
      contentType: req.file.mimetype,
      metadata: { category, zone, branch, fileNumber },
    });

    // Use Promise-based pipeline to improve code readability and efficiency
    await new Promise((resolve, reject) => {
      readableStream.pipe(uploadStream)
        .on('error', reject)
        .on('finish', resolve);
    });

    console.log(`File uploaded to GridFS: ${originalFilename}, ID: ${uploadStream.id}`);

    // Metadata save without blocking response
    const file = new File({
      filename: originalFilename,
      filetype: req.file.mimetype,
      lastModified: new Date().toISOString(),
      fileId: uploadStream.id,
      category,
      zone,
      branch,
      fileNumber,
    });

    file.save().catch(error => console.error('Error saving file metadata:', error));

    res.status(201).json({ message: 'File uploaded successfully', fileId: uploadStream.id });

  } catch (error) {
    console.error('Error during file upload:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 3. Download a file from GridFS
app.get('/api/files/download/:filename', async (req, res) => {
  try {
    const decodedFilename = decodeURIComponent(req.params.filename); // Decode the filename
    const file = await File.findOne({ filename: decodedFilename });

    if (!file) {
      console.error(`File not found: ${decodedFilename}`);
      return res.status(404).json({ message: 'File not found' });
    }

    const downloadStream = gridfsBucket.openDownloadStreamByName(file.filename);

    res.set('Content-Type', file.filetype);
    res.set('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.set('Cache-Control', 'no-store'); // Prevent browser caching issues

    downloadStream.pipe(res)
      .on('error', (err) => {
        console.error('Error streaming file:', err);
        res.status(500).json({ message: 'Error retrieving file' });
      });
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 4. Delete a file and remove its metadata
app.delete('/api/files/:category/:zone/:branch/:filename', async (req, res) => {
  try {
    const { category, zone, branch, filename } = req.params;
    const trimmedFilename = decodeURIComponent(filename.trim());

    console.log('DELETE Request Params:', { category, zone, branch, filename: trimmedFilename });

    // Find the file metadata in MongoDB (`files` collection)
    const fileDoc = await File.findOne({ filename: trimmedFilename, category, zone, branch });

    if (!fileDoc) {
      console.error('File not found in metadata:', trimmedFilename);
      return res.status(404).json({ message: 'File not found' });
    }

    console.log('File found in metadata:', fileDoc);

    // Remove the file metadata from MongoDB (`files` collection) first
    const metadataDeleteResult = await File.deleteOne({ _id: fileDoc._id });
    if (metadataDeleteResult.deletedCount === 0) {
      console.error('Failed to delete file metadata:', fileDoc._id);
      return res.status(500).json({ message: 'Failed to delete file metadata' });
    }

    console.log('File metadata deleted from MongoDB (`files` collection):', fileDoc._id);

    // Now delete the file from GridFS (`uploads.files` and `uploads.chunks`)
    gridfsBucket.delete(fileDoc.fileId, (err) => {
      if (err) {
        console.error('Error deleting from GridFS:', err);
        return res.status(500).json({ message: 'Failed to delete from GridFS' });
      }

      console.log('File deleted from GridFS:', fileDoc.fileId);
      res.json({ message: 'File deleted successfully' });
    });
  } catch (error) {
    console.error('Error during file deletion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------------------------------------ Ticket System ---------------------------------------------------------------------------

// Ticket Schema
const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true }, // Unique 5-digit ticket ID
  subject: { type: String, required: true }, // Ticket subject
  description: { type: String, required: true }, // Ticket description
  status: { type: String, default: 'Open' }, // Status: Open, In Progress, Closed
  createdBy: { type: String, required: true }, // User who created the ticket
  createdAt: { type: Date, default: Date.now }, // Creation date
  updatedAt: { type: Date, default: Date.now }, // Last updated date
});

const Ticket = mongoose.model('Ticket', ticketSchema);

// Create a new ticket
app.post('/api/tickets', async (req, res) => {
  try {
    const { subject, description, createdBy } = req.body;

    // Generate a unique 5-digit ticket ID
    const ticketId = Math.floor(10000 + Math.random() * 90000).toString();

    // Create a new ticket
    const newTicket = new Ticket({
      ticketId,
      subject,
      description,
      createdBy,
    });

    await newTicket.save(); // Save the ticket in MongoDB
    res.status(201).json({ message: 'Ticket created successfully', ticket: newTicket });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all tickets
app.get('/api/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find(); // Retrieve all tickets
    res.status(200).json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a ticket by its ID
app.get('/api/tickets/:ticketId', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.status(200).json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update ticket status
app.put('/api/tickets/:ticketId/status', async (req, res) => {
  try {
    const { status } = req.body;

    const ticket = await Ticket.findOneAndUpdate(
      { ticketId: req.params.ticketId },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.status(200).json({ message: 'Ticket status updated', ticket });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a ticket
app.delete('/api/tickets/:ticketId', async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndDelete({ ticketId: req.params.ticketId });

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.status(200).json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


//----------------------------------------------TASK MANAGEMENT ------------------------------------------------

// Task Schema
const taskSchema = new mongoose.Schema({
  taskName: { type: String, required: true },
  date: { type: String, required: true },
  deadline: { type: Date, required: true },
  zone: { type: String, required: true },
  branch: { type: String, required: true },
});

const Task = mongoose.model('Task', taskSchema);

// Add a new task
app.post('/api/tasks', async (req, res) => {
  try {
    const { taskName, date, deadline, zone, branch } = req.body;

    if (!taskName || !date || !deadline || !zone || !branch) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const newTask = new Task({
      taskName,
      date,
      deadline,
      zone,
      branch,
    });

    await newTask.save();
    res.status(201).json({ message: 'Task added successfully', task: newTask });
  } catch (error) {
    console.error('Error adding task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const { zone, branch } = req.query;
    let filter = {};
    
    if (zone && zone !== 'All') {
      filter.zone = zone;
    }
    if (branch && branch !== 'All') {
      filter.branch = branch;
    }

    const tasks = await Task.find(filter);
    res.status(200).json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a task by ID
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { taskName, date, deadline, zone, branch } = req.body;

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { taskName, date, deadline, zone, branch },
      { new: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json({ message: 'Task updated successfully', task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const deletedTask = await Task.findByIdAndDelete(req.params.id);

    if (!deletedTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

//-------------------------------ANNOUNCEMENTS-------------------------------------------
// Define Announcement schema
const announcementSchema = new mongoose.Schema({
  announcement: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Create Announcement model from the schema
const Announcement = mongoose.model('Announcement', announcementSchema);

// API to add a new announcement
app.post('/api/announcements', async (req, res) => {
  try {
    const { announcement, createdBy } = req.body;

    // Create a new announcement object
    const newAnnouncement = new Announcement({
      announcement,
      createdBy,
    });

    // Save the announcement to the database
    await newAnnouncement.save();

    res.status(201).json({ message: 'Announcement created successfully', announcement: newAnnouncement });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// API to get all announcements
app.get('/api/announcements', async (req, res) => {
  try {
    const announcements = await Announcement.find(); // Fetch all announcements
    res.status(200).json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/announcements/latest', async (req, res) => {
  try {
    const latestAnnouncement = await Announcement.findOne().sort({ createdAt: -1 });
    res.status(200).json(latestAnnouncement);
  } catch (error) {
    console.error('Error fetching the latest announcement:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

//---------------------------------------------SESSION TIME OUT----------------------------------------------------------

const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send({ message: 'No token provided.' });

    jwt.verify(token, 'your-secret-key', (err, decoded) => {
        if (err) return res.status(401).send({ message: 'Failed to authenticate token.' });
        req.userId = decoded.id;
        next();
    });
};

app.get('/api/auth/check-session', verifyToken, (req, res) => {
    res.status(200).send({ message: 'Session active' });
});

//----------------------------------------------ASSIGNED TASK MANAGEMENT ------------------------------------------------

// Modify AssignedTask Schema to track completed users
const assignedTaskSchema = new mongoose.Schema({
  taskName: { type: String, required: true },
  date: { type: String, required: true },
  deadline: { type: Date, required: true },
  zone: { type: String, required: true },
  branch: { type: String, required: true },
  completedBy: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] }, // Array of user IDs who completed the task
  completed: { type: Boolean, default: false }, // Completion status for the task
});

const AssignedTask = mongoose.model('AssignedTask', assignedTaskSchema);

// Endpoint to mark an assigned task as completed by a user
app.patch('/api/assignedTasks/:taskId/complete', async (req, res) => {
  const { branch } = req.body; // Branch from request body
  const { taskId } = req.params;

  try {
    if (!branch) {
      return res.status(400).json({ message: 'Branch is required' });
    }

    const assignedTask = await AssignedTask.findById(taskId);
    if (!assignedTask) {
      return res.status(404).json({ message: 'Assigned task not found' });
    }

    // Mark the task as completed
    assignedTask.completed = true;
    await assignedTask.save();

    res.status(200).json({ message: 'Assigned task marked as completed' });
  } catch (error) {
    console.error('Error marking assigned task as completed:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch assigned tasks for the logged-in user based on their zone, branch, and completion status
app.get('/api/user/assignedTasks', async (req, res) => {
  const { zone, branch, completed } = req.query;

  try {
    if (!zone || !branch) {
      return res.status(400).json({ message: 'Zone and branch are required' });
    }

    // Build the query filter
    const filter = { zone, branch };

    // Filter assigned tasks based on completion status
    if (completed === 'true') {
      filter.completed = true;
    } else if (completed === 'false') {
      filter.completed = false;
    }

    const assignedTasks = await AssignedTask.find(filter);
    res.status(200).json(assignedTasks);
  } catch (error) {
    console.error('Error fetching user assigned tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a new assigned task
app.post('/api/assignedTasks', async (req, res) => {
  try {
    const { taskName, date, deadline, zone, branch } = req.body;

    if (!taskName || !date || !deadline || !zone || !branch) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const newAssignedTask = new AssignedTask({
      taskName,
      date,
      deadline,
      zone,
      branch,
    });

    await newAssignedTask.save();
    res.status(201).json({ message: 'Assigned task added successfully', task: newAssignedTask });
  } catch (error) {
    console.error('Error adding assigned task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

//--------------------------------------------------EXPIRY OF CYLINDERS---------------------------------------
const locationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
});
const Location = mongoose.model('Location', locationSchema);

// Category Schema
// Matches your data: each category has a name and a weight field (like "6 kg", "5-10 Litre")
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  weight: { type: String, required: true }
});
const Category = mongoose.model('Category', categorySchema);

// Cylinder Expiry Schema
// Includes zone and branch, as well as category details and date.
const CylinderExpirySchema = new mongoose.Schema({
  location: { type: String, required: true },
  categories: [{
    category: { type: String, required: true },
    weight: { type: String, required: true },
    date: { type: Date, required: true }
  }],
  zone: { type: String, required: true },
  branch: { type: String, required: true }
});
const CylinderExpiry = mongoose.model('CylinderExpiry', CylinderExpirySchema);

// API to get all locations
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await Location.find();
    res.json(locations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching locations', error: error.message });
  }
});

// API to get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

// API to save cylinder expiry data, including zone and branch
app.post('/api/cylinder-expiry', async (req, res) => {
  const { location, categories, zone, branch } = req.body;

  // Validate presence of zone and branch
  if (!zone || !branch) {
    return res.status(400).json({ error: 'Zone and branch are required fields.' });
  }

  const cylinderExpiryData = new CylinderExpiry({
    location,
    categories,
    zone,
    branch
  });

  try {
    await cylinderExpiryData.save();
    res.status(201).json(cylinderExpiryData);
  } catch (error) {
    console.error('Error saving cylinder expiry data:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.get('/api/cylinder-expiry/:zone/:branch', async (req, res) => {
  const { zone, branch } = req.params;
  try {
    // Find all cylinder expiry records that match the given zone and branch
    const cylinders = await CylinderExpiry.find({ zone, branch });

    if (cylinders.length === 0) {
      // If no records found, return 404
      return res.status(404).json({ message: 'No cylinders found for this zone and branch.' });
    }

    // Return the found cylinders as JSON
    res.json(cylinders);
  } catch (error) {
    console.error('Error fetching cylinders:', error);
    res.status(500).json({ error: 'Server error fetching cylinders.' });
  }
});

// DELETE route to remove a cylinder record by ID
app.delete('/api/cylinder-expiry/:id', async (req, res) => {
  const { id } = req.params;
  console.log("Attempting to delete ID:", id); // Debugging

  try {
    const deletedRecord = await CylinderExpiry.findByIdAndDelete(id);
    console.log("Deleted record:", deletedRecord); // Debugging
    if (!deletedRecord) {
      return res.status(404).json({ message: 'No cylinder record found with that ID.' });
    }
    res.status(200).json({ message: 'Cylinder record deleted successfully.' });
  } catch (error) {
    console.error('Error deleting cylinder record:', error);
    res.status(500).json({ error: 'Failed to delete cylinder record.' });
  }
});


// POST /api/locations
app.post('/api/locations', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Location name is required.' });
  }

  try {
    const newLocation = new Location({ name });
    await newLocation.save();
    res.status(201).json(newLocation);
  } catch (error) {
    console.error('Error adding location:', error);
    res.status(500).json({ error: 'Failed to add location.' });
  }
});

// POST /api/categories
app.post('/api/categories', async (req, res) => {
  const { name, weight } = req.body;
  if (!name || !weight) {
    return res.status(400).json({ error: 'Category name and weight are required.' });
  }

  try {
    const newCategory = new Category({ name, weight });
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ error: 'Failed to add category.' });
  }
});

// PUT /api/locations/:id
// Body: { name: "New Location Name" }
app.put('/api/locations/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Location name is required.' });

  try {
    const updated = await Location.findByIdAndUpdate(id, { name }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Location not found.' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location.' });
  }
});

// PUT /api/categories/:id
// Body: { name: "New Category Name", weight: "New Weight" }
app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name, weight } = req.body;
  if (!name || !weight) return res.status(400).json({ error: 'Name and weight are required.' });

  try {
    const updated = await Category.findByIdAndUpdate(id, { name, weight }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Category not found.' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category.' });
  }
});

// DELETE /api/locations/:id
app.delete('/api/locations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Location.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Location not found.' });
    res.json({ message: 'Location deleted successfully.' });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ error: 'Failed to delete location.' });
  }
});

// DELETE /api/categories/:id
app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Category.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Category not found.' });
    res.json({ message: 'Category deleted successfully.' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category.' });
  }
});