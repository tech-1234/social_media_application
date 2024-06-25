import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from "../utils/ApiError.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Post } from '../models/post.model.js';
import { User } from '../models/user.model.js';
import mongoose, { isValidObjectId } from 'mongoose';


const getAllPosts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query = "", sortBy = "createdAt", sortType = 1, userId } = req.query;

    // Ensure sortType is a number
    const sortDirection = parseInt(sortType, 10);

    // Match condition for the aggregation pipeline
    const matchCondition = {
        $or: [
            { caption: { $regex: query, $options: "i" } },
        ]
    };

    if (userId) {
        matchCondition.owner = new mongoose.Types.ObjectId(userId);
    }
    let postAggregate;
    try {
        postAggregate = Post.aggregate([
            {
                $match: matchCondition
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                fullName: 1,
                                avatar: "$avatar.url",
                                username: 1,
                            }
                        }
                    ]
                }
            },
            {
                $addFields: {
                    owner: {
                        $first: "$owner",
                    },
                },
            },
            // sorting according to sortType which is ascending in this case
            {
                $sort: {
                    [sortBy]: sortDirection
                }
            }
        ])
    } catch (error) {
        throw new ApiError(500, error.message || "Internal server error in post aggregation");
    }
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        customLabels: {
            totalDocs: "totalPosts",
            docs: "posts",
        },
        skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    };

    Post.aggregatePaginate(postAggregate, options)
        .then(result => {
            if (result?.posts?.length === 0 && userId) {
                return res.status(200).json(new ApiResponse(200, [], "No posts found"));
            }

            return res.status(200).json(new ApiResponse(200, result, "Post fetched successfully"));
        })
        .catch(error => {
            console.log("Error:", error);
            throw new ApiError(500, error?.message || "Internal server error in post aggregate paginate");
        });
})

const publishAPost = asyncHandler(async (req, res) => {
    const { caption } = req.body;
    if (!caption) throw new ApiError("Caption is required")
    const photoFileLocalPath = req.files?.photo[0]?.path;
    if (!photoFileLocalPath) throw new ApiError(400, "Photo is missing")
    const photo = await uploadOnCloudinary(photoFileLocalPath);
    if (!photo) throw new ApiError(400, "Something went wrong while upload this photo to cloudinary")

    const post = await Post.create({
        caption,
        photo: { publicId: photo?.public_id, url: photo?.url },
        owner: req.user?._id
    })

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                {
                    ...post._doc,
                    photo: photo.url
                },
                "Post published successfully"
            )
        )
})

export {
    getAllPosts,
    publishAPost
}