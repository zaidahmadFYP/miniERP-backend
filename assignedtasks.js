
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