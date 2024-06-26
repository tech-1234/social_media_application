import { Router } from 'express'
import { upload } from '../middlewares/multer.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { deletePost, getAllPosts, getPostbyId, publishAPost, togglePublishStatus, updatePost } from '../controllers/post.controller.js';

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

router
    .route("/:postId")
    .get(getPostbyId)
    .patch(updatePost)
    .delete(deletePost)

router.route("/toggle/publish/:postId").patch(togglePublishStatus);

export default router
