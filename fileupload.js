
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
