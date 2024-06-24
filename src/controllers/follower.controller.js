import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Follower } from '../models/follower.model.js'
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";

const toggleFollow = asyncHandler(async (req, res) => {
    const { followingId } = req.params;
    if (!isValidObjectId(followingId)) throw new ApiError(401, "Invalid channel Id");
    if (!req.user?._id) throw new ApiError(401, "Unauthorized user");
    const followerId = req.user?._id
    const isFollowed = await Follower.findOne({
        followingId,
        followerId
    });
    var response;
    try {
        response = isFollowed
            ?
            await Follower.deleteOne({ followingId, followerId })
            :
            await Follower.create({ followingId, followerId })
    } catch (error) {
        console.log("toggleFollow error ::", error)
        throw new ApiError(500, error?.message || "Internal server error in toggleFollow")
    }
    return res.status(200)
        .json(
            new ApiResponse(
                200,
                response,
                isFollowed === null ? "Followed successfully" : "Unfollowed successfully"

            )
        )
})

const getUserFollowing = asyncHandler(async (req, res) => {
    const { followerId } = req.params;
    if (!isValidObjectId(followerId)) throw new ApiError(400, "Follower id is not a valid id");
    if (!req.user?._id) throw new ApiError(404, "Unauthorized user")
    const pipeline = [
        {
            $match: {
                followerId: new mongoose.Types.ObjectId(followerId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "followingId",
                foreignField: "_id",
                as: "following",
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            username: 1,
                            avatar: "$avatar.url",
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$following"
        },
        {
            $project: {
                following: "$following"
            }
        }
    ]
    try {
        const following = await Follower.aggregate(pipeline);
        const followingList = following.map(item => item.following)
        // console.log(followingList);
        return res.status(200)
            .json(
                new ApiResponse(
                    200,
                    followingList,
                    "getUserFollowing fetched successfully"
                )
            )

    } catch (error) {
        console.log("getUserFollowing error ::", error)
        throw new ApiError(
            500,
            error?.message || "Internal server error in getUserFollowing"
        )
    }
})

const getUserFollowers = asyncHandler(async (req, res) => {
    const { followingId } = req.params;
    if (!isValidObjectId(followingId)) throw new ApiError(400, "Invalid follower id")
    if (!req.user?._id) throw new ApiError(404, "Unauthorized user");
    const user = await User.findById(req.user?._id, { _id: 1 });
    if (!user) throw new ApiError(404, "User not found")
    const pipeline = [
        {
            $match: {
                followingId: new mongoose.Types.ObjectId(followingId),
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "followerId",
                foreignField: "_id",
                as: "follower",
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            username: 1,
                            avatar: "$avatar.url"
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                follower: {
                    $first: "$follower"
                }
            }
        }
    ]
    try {
        const followers = await Follower.aggregate(pipeline);
        const followersList = followers.map(item => item.follower)
        return res.status(200)
            .json(
                new ApiResponse(
                    200,
                    followersList,
                    "Followers List fetched successfully"
                )

            )

    } catch (error) {
        console.log("getUserFollowers error ::", error)
        throw new ApiError(
            500,
            error?.message || "Internal server error in getUserFollowers"
        )
    }

})

export {
    getUserFollowing,
    getUserFollowers,
    toggleFollow
}