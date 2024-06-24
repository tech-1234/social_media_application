import { Router } from 'express'
import { upload } from '../middlewares/multer.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { getAllPosts, publishAPost } from '../controllers/post.controller.js';

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file


router
    .route("/")
    .get(getAllPosts)
    .post(
        upload.fields([
            {
                name: "photo",
                maxCount: 1,
            },

        ]),
        publishAPost
    );

export default router
