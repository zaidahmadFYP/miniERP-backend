
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
  
  // -----------------------------------------