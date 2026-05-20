import { EmailJob } from "../models/emailJob.model.js";
import { EmailEvent } from "../models/emailEvent.model.js";


// these url endpoints will be decided later on.
// GET /emails
export const getAllEmailJobs = async (req, res) => {
  const jobs = await EmailJob.find().sort({ createdAt: -1 });
  res.json(jobs);
};

// GET /emails/:id
export const getEmailTimeline = async (req, res) => {
  const { id } = req.params;

  const job = await EmailJob.findById(id);
  const events = await EmailEvent.find({ jobId: id }).sort({ createdAt: 1 });

  res.json({ job, events });
};