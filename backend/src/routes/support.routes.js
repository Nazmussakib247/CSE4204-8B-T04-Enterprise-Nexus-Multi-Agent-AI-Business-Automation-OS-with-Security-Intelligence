const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { OFFICE_ROLES } = require('../middleware/roles');
const validate = require('../middleware/validate.middleware');
const { createTicketSchema, updateTicketSchema, replyTicketSchema, createMessageSchema } = require('../validators/support.validators');
const {
  getTickets, getTicket, createTicket, updateTicket, escalateTicket, getSentimentReport, resolveTicket, replyToTicket, createMessage,
} = require('../controllers/support.controller');

router.use(protect);

router.get('/sentiment-report', getSentimentReport);
router.get('/tickets', getTickets);
router.get('/tickets/:id', getTicket);
router.post('/tickets', validate(createTicketSchema), createTicket);
router.patch('/tickets/:id', validate(updateTicketSchema), updateTicket);
router.patch('/tickets/:id/escalate', escalateTicket);
router.patch('/tickets/:id/resolve', resolveTicket);
router.patch('/tickets/:id/reply', authorize(...OFFICE_ROLES), validate(replyTicketSchema), replyToTicket);
router.post('/tickets/:id/messages', validate(createMessageSchema), createMessage);

module.exports = router;
