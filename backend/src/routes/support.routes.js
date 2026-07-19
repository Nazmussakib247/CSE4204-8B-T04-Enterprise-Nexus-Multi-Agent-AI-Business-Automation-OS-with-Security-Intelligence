const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createTicketSchema, updateTicketSchema } = require('../validators/support.validators');
const {
  getTickets, getTicket, createTicket, updateTicket, escalateTicket, getSentimentReport, resolveTicket,
} = require('../controllers/support.controller');

router.use(protect);

router.get('/sentiment-report', getSentimentReport);
router.get('/tickets', getTickets);
router.get('/tickets/:id', getTicket);
router.post('/tickets', validate(createTicketSchema), createTicket);
router.patch('/tickets/:id', validate(updateTicketSchema), updateTicket);
router.patch('/tickets/:id/escalate', escalateTicket);
router.patch('/tickets/:id/resolve', resolveTicket);

module.exports = router;
