import { Router } from 'express'
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { getUserFollowers, getUserFollowing, toggleFollow } from '../controllers/follower.controller.js';

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router
    .route("/c/:followerId")
    .get(getUserFollowing)

router
    .route("/c/:followingId")
    .post(toggleFollow)

router.route("/u/:followingId").get(getUserFollowers);

export default router