const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const commentController = require('../controllers/commentController');
const attachmentController = require('../controllers/attachmentController');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticateToken);

// AI Assistance Endpoints
router.post('/ai-generate', taskController.generateAiDescription);
router.get('/:id/ai-summary', taskController.getAiSummary);

// Task CRUD
router.post('/', taskController.createTask);
router.get('/', taskController.getTasks);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

// Comments
router.post('/:id/comments', commentController.addComment);
router.get('/:id/comments', commentController.getComments);

// Attachments
router.post('/:id/attachments', upload.single('file'), attachmentController.uploadAttachment);
router.get('/:id/attachments', attachmentController.getAttachments);
router.get('/:id/attachments/:attachmentId/download', attachmentController.downloadAttachment);

module.exports = router;
